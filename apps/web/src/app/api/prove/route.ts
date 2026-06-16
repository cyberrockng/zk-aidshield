import { NextRequest, NextResponse } from 'next/server';
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Loaded once and cached for the lifetime of the server
let circuit: object | null = null;

function getCircuit() {
  if (!circuit) {
    const circuitPath = join(process.cwd(), 'public', 'circuit.json');
    circuit = JSON.parse(readFileSync(circuitPath, 'utf-8'));
  }
  return circuit as { bytecode: string; abi: object };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      secret,
      merkle_path,
      path_indices,
      disbursement_id,
      merkle_root,
      nullifier,
      claimant_address,
    } = body;

    if (
      !secret || !merkle_path || !path_indices || !disbursement_id ||
      !merkle_root || !nullifier || !claimant_address
    ) {
      return NextResponse.json({ error: 'Missing required inputs' }, { status: 400 });
    }

    const c = getCircuit();
    const api = await Barretenberg.new({ threads: 4 });
    const backend = new UltraHonkBackend(c.bytecode, api);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noir = new Noir(c as any);

    const inputs = {
      secret: `0x${secret}`,
      merkle_path: (merkle_path as string[]).map((h) => `0x${h}`),
      path_indices,
      disbursement_id: `0x${disbursement_id}`,
      merkle_root: `0x${merkle_root}`,
      nullifier: `0x${nullifier}`,
      claimant_address: `0x${claimant_address}`,
    };

    const { witness } = await noir.execute(inputs);
    const { proof, publicInputs } = await backend.generateProof(witness);

    await api.destroy();

    return NextResponse.json({
      proof: Buffer.from(proof).toString('hex'),
      publicInputs,
      proofSize: proof.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
