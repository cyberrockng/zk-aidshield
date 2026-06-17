/**
 * Poseidon hash for BLS12-381 scalar field.
 *
 * Must exactly match what the circom circuit computes when compiled with
 * --curve BLS12381 and using circomlib's poseidon.circom template.
 *
 * Approach: circomlib's Poseidon uses round constants originally generated
 * for BN254, but since BN254_prime < BLS12381_prime, all those constants
 * are also valid BLS12-381 field elements.  The circuit, compiled with
 * --curve BLS12381, runs ALL arithmetic mod the BLS12-381 prime — so we
 * borrow the same constant tables from circomlibjs but compute the sponge
 * mod BLS12-381 prime.
 *
 * BLS12-381 scalar field prime r:
 *   0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001
 */

import { buildPoseidon } from "circomlibjs";

const BLS12_381_R =
  52435875175126190479447740508185965837690552500527637822603658699938581184513n;

let _poseidonConstants: {
  C: bigint[][];
  M: bigint[][][];
} | null = null;

async function getPoseidonConstants() {
  if (_poseidonConstants) return _poseidonConstants;
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const toBI = (x: unknown): bigint => BigInt(F.toObject(x));
  const C = (poseidon.C as unknown[][]).map((arr) => (arr as unknown[]).map(toBI));
  const M = (poseidon.M as unknown[][][]).map((mat) =>
    (mat as unknown[][]).map((row) => (row as unknown[]).map(toBI)),
  );
  _poseidonConstants = { C, M };
  return _poseidonConstants;
}

export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const p = BLS12_381_R;
  const mod = (x: bigint) => ((x % p) + p) % p;
  const add = (a: bigint, b: bigint) => mod(a + b);
  const mul = (a: bigint, b: bigint) => mod(a * b);
  const pow5 = (x: bigint) => mul(mul(mul(x, x), mul(x, x)), x);

  const { C, M } = await getPoseidonConstants();
  const t = inputs.length + 1;
  const nRoundsF = 8;
  const nRoundsP = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68][t - 2];
  const cArr = C[t - 2];
  const mArr = M[t - 2];

  let state: bigint[] = [0n, ...inputs.map((x) => mod(x))];
  for (let i = 0; i < t; i++) state[i] = add(state[i], cArr[i]);

  let cntr = t;
  for (let r = 0; r < nRoundsF + nRoundsP; r++) {
    if (r < nRoundsF / 2 || r >= nRoundsF / 2 + nRoundsP) {
      for (let i = 0; i < t; i++) state[i] = pow5(state[i]);
    } else {
      state[0] = pow5(state[0]);
    }
    const ns: bigint[] = new Array<bigint>(t).fill(0n);
    for (let i = 0; i < t; i++)
      for (let j = 0; j < t; j++)
        ns[i] = add(ns[i], mul(mArr[i][j], state[j]));
    state = ns;
    if (r < nRoundsF + nRoundsP - 1) {
      for (let i = 0; i < t; i++) state[i] = add(state[i], cArr[cntr + i]);
      cntr += t;
    }
  }
  return state[0];
}

/** leaf = Poseidon(secret, disbursement_id) — matches circuit's leafHasher */
export async function computeLeaf(
  secret: bigint,
  disbursementId: bigint,
): Promise<bigint> {
  return poseidonHash([secret, disbursementId]);
}

/** nullifier = Poseidon(secret, disbursement_id, claimant_address, 1) */
export async function computeNullifier(
  secret: bigint,
  disbursementId: bigint,
  claimantAddress: bigint,
): Promise<bigint> {
  return poseidonHash([secret, disbursementId, claimantAddress, 1n]);
}

/**
 * Generates a random 31-byte secret (248 bits — always below BLS12-381 r ≈ 2^255).
 */
export function randomSecret(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  return bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
}
