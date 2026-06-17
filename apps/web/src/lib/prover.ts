'use client';

// Client-side ZK proof generation.
// The secret NEVER leaves this device — all computation runs in the browser via WASM.

export interface ProverInput {
  secret: string;          // 64-char hex
  merkle_path: string[];   // 8 × 64-char hex
  path_indices: boolean[]; // 8 booleans
  disbursement_id: string; // 64-char hex
  merkle_root: string;     // 64-char hex
  claimant_address: string; // 62–64 char hex (stellarAddressToField output)
}

export interface ProverOutput {
  proof: string;           // hex
  publicInputs: string[];  // array of 0x-prefixed hex field elements
  nullifier: string;       // hex — address-bound, derived here, never sent to server
  proofSize: number;
}

function toBytes32(n: bigint): Uint8Array {
  const hex = n.toString(16).padStart(64, '0');
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

let circuitCache: { bytecode: string; abi: object } | null = null;

async function getCircuit(): Promise<{ bytecode: string; abi: object }> {
  if (circuitCache) return circuitCache;
  const res = await fetch('/circuit.json');
  if (!res.ok) throw new Error(`Failed to load circuit: ${res.status}`);
  circuitCache = await res.json();
  return circuitCache!;
}

export async function generateProof(
  input: ProverInput,
  onProgress?: (msg: string) => void,
): Promise<ProverOutput> {
  const log = onProgress ?? (() => {});

  log('Loading ZK circuit…');
  const circuit = await getCircuit();

  log('Initialising Barretenberg WASM (multi-threaded)…');
  const { Barretenberg, UltraHonkBackend } = await import('@aztec/bb.js');
  const { Noir } = await import('@noir-lang/noir_js');

  // threads: 4 requires SharedArrayBuffer (enabled by COOP/COEP headers in next.config.mjs)
  const api = await Barretenberg.new({ threads: 4 });

  try {
    log('Deriving address-bound nullifier…');
    const addrPadded = input.claimant_address.padStart(64, '0');
    const nullifierResult = await api.pedersenHash({
      inputs: [
        toBytes32(BigInt('0x' + input.secret)),
        toBytes32(BigInt('0x' + input.disbursement_id)),
        toBytes32(BigInt('0x' + addrPadded)),
        toBytes32(1n),
      ],
      hashIndex: 0,
    });
    const nullifierHex = Buffer.from(nullifierResult.hash).toString('hex');

    log('Executing Noir circuit…');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noir = new Noir(circuit as any);
    const { witness } = await noir.execute({
      secret: `0x${input.secret}`,
      merkle_path: input.merkle_path.map((h) => `0x${h}`),
      path_indices: input.path_indices,
      disbursement_id: `0x${input.disbursement_id}`,
      merkle_root: `0x${input.merkle_root}`,
      nullifier: `0x${nullifierHex}`,
      claimant_address: `0x${addrPadded}`,
    });

    log('Generating UltraHonk proof (this takes ~30 s)…');
    const backend = new UltraHonkBackend(circuit.bytecode, api);
    const { proof, publicInputs } = await backend.generateProof(witness);

    return {
      proof: Buffer.from(proof).toString('hex'),
      publicInputs,
      nullifier: nullifierHex,
      proofSize: proof.length,
    };
  } finally {
    await api.destroy();
  }
}
