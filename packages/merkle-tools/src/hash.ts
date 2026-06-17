/**
 * Pedersen hash wrapper that matches Noir's std::hash::pedersen_hash.
 * Uses Barretenberg (bb.js) — the same backend Noir's prover uses.
 * Critical: any hash computed here must match what the Noir circuit computes.
 */

import { Barretenberg } from "@aztec/bb.js";

let bb: Barretenberg | null = null;

async function getBb(): Promise<Barretenberg> {
  if (!bb) {
    bb = await Barretenberg.new({ threads: 1 });
  }
  return bb;
}

function toBytes32(n: bigint): Uint8Array {
  const hex = n.toString(16).padStart(64, "0");
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

/**
 * Computes Pedersen hash of an array of field elements.
 * Matches: std::hash::pedersen_hash([a, b, ...]) in Noir.
 */
export async function pedersenHash(inputs: bigint[]): Promise<bigint> {
  const barretenberg = await getBb();
  const result = await barretenberg.pedersenHash({
    inputs: inputs.map(toBytes32),
    hashIndex: 0,
  });
  return BigInt("0x" + Buffer.from(result.hash).toString("hex"));
}

/**
 * Computes the leaf commitment for a beneficiary.
 * Matches: let leaf = std::hash::pedersen_hash([secret, disbursement_id])
 */
export async function computeLeaf(
  secret: bigint,
  disbursementId: bigint
): Promise<bigint> {
  return pedersenHash([secret, disbursementId]);
}

/**
 * Computes the address-bound nullifier for a beneficiary claim.
 * Matches: let nullifier = std::hash::pedersen_hash([secret, disbursement_id, claimant_address, 1])
 * The claimant_address prevents proof portability: an intercepted proof cannot be
 * replayed from a different wallet address.
 */
export async function computeNullifier(
  secret: bigint,
  disbursementId: bigint,
  claimantAddress: bigint
): Promise<bigint> {
  return pedersenHash([secret, disbursementId, claimantAddress, 1n]);
}

/**
 * Generates a random 31-byte field element safe for BN254.
 * (BN254 field modulus is ~254 bits; 31 bytes = 248 bits — always in range)
 */
export function randomSecret(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
}

export async function cleanup(): Promise<void> {
  if (bb) {
    await bb.destroy();
    bb = null;
  }
}
