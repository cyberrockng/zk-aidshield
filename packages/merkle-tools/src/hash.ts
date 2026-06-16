/**
 * Pedersen hash wrapper that matches Noir's std::hash::pedersen_hash.
 * Uses Barretenberg (bb.js) — the same backend Noir's prover uses.
 * Critical: any hash computed here must match what the Noir circuit computes.
 */

import { Barretenberg, Fr } from "@aztec/bb.js";

let bb: Barretenberg | null = null;

async function getBb(): Promise<Barretenberg> {
  if (!bb) {
    bb = await Barretenberg.new(1);
  }
  return bb;
}

/**
 * Computes Pedersen hash of an array of field elements.
 * Matches: std::hash::pedersen_hash([a, b, ...]) in Noir.
 */
export async function pedersenHash(inputs: bigint[]): Promise<bigint> {
  const barretenberg = await getBb();
  const frInputs = inputs.map((n) => new Fr(n));
  const result = await barretenberg.pedersenHash(frInputs, 0);
  return BigInt("0x" + Buffer.from(result.value).toString("hex"));
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
 * Computes the nullifier for a beneficiary claim.
 * Matches: let nullifier = std::hash::pedersen_hash([secret, disbursement_id, 1])
 */
export async function computeNullifier(
  secret: bigint,
  disbursementId: bigint
): Promise<bigint> {
  return pedersenHash([secret, disbursementId, 1n]);
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
