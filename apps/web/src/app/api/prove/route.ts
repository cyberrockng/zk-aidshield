import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { readFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let circuit: { bytecode: string; abi: object } | null = null;

function getCircuit() {
  if (!circuit) {
    circuit = JSON.parse(readFileSync(join(process.cwd(), 'public', 'circuit.json'), 'utf-8'));
  }
  return circuit!;
}

const Hex32 = z.string().regex(/^[0-9a-fA-F]{64}$/);
const ClaimProofPayload = z.object({
  secret: Hex32,
  merkle_path: z.array(Hex32).length(8),
  path_indices: z.array(z.boolean()).length(8),
  disbursement_id: Hex32,
  merkle_root: Hex32,
  claimant_address: z.string().regex(/^[0-9a-fA-F]{62,64}$/),
});

function toBytes32(n: bigint): Uint8Array {
  const hex = n.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

export async function POST(req: NextRequest) {
  let api: Barretenberg | null = null;
  try {
    const rawBody = await req.json();
    const body = ClaimProofPayload.parse(rawBody);

    const c = getCircuit();
    api = await Barretenberg.new({ threads: 4 });
    const backend = new UltraHonkBackend(c.bytecode, api);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noir = new Noir(c as any);

    // Derive address-bound nullifier = pedersen(secret, disbursement_id, claimant_address, 1)
    const addrPadded = body.claimant_address.padStart(64, '0');
    const nullifierResult = await api.pedersenHash({
      inputs: [
        toBytes32(BigInt('0x' + body.secret)),
        toBytes32(BigInt('0x' + body.disbursement_id)),
        toBytes32(BigInt('0x' + addrPadded)),
        toBytes32(1n),
      ],
      hashIndex: 0,
    });
    const nullifierHex = Buffer.from(nullifierResult.hash).toString('hex');

    const inputs = {
      secret: `0x${body.secret}`,
      merkle_path: body.merkle_path.map((h) => `0x${h}`),
      path_indices: body.path_indices,
      disbursement_id: `0x${body.disbursement_id}`,
      merkle_root: `0x${body.merkle_root}`,
      nullifier: `0x${nullifierHex}`,
      claimant_address: `0x${addrPadded}`,
    };

    const { witness } = await noir.execute(inputs);
    const { proof, publicInputs } = await backend.generateProof(witness);

    return NextResponse.json(
      {
        proof: Buffer.from(proof).toString('hex'),
        publicInputs,
        nullifier: nullifierHex,
        proofSize: proof.length,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e: unknown) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: e.errors }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (api) await api.destroy();
  }
}
