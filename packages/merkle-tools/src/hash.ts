/**
 * Poseidon hash for BLS12-381 scalar field.
 *
 * The circom circuit uses the OPTIMISED Poseidon from circomlib/poseidon.circom,
 * which reads from poseidon_constants_opt.circom.  This file implements the same
 * optimised sponge with BigInt arithmetic mod the BLS12-381 prime.
 *
 * Round constants (C, S, M, P) come from circomlibjs poseidon_constants_opt.js.
 * The constants are reduced under the BLS12-381 scalar-field modulus used by
 * the compiled circuit.
 */

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const BLS12_381_R =
  52435875175126190479447740508185965837690552500527637822603658699938581184513n;

const N_ROUNDS_F = 8;
const N_ROUNDS_P = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];

const pr = BLS12_381_R;
const fmod = (x: bigint): bigint => ((x % pr) + pr) % pr;
const fadd = (a: bigint, b: bigint): bigint => fmod(a + b);
const fmul = (a: bigint, b: bigint): bigint => fmod(a * b);
const fpow5 = (x: bigint): bigint => fmul(fmul(fmul(x, x), fmul(x, x)), x);

// ── Constants loader ──────────────────────────────────────────────────────────

interface RawConsts {
  C: string[][];
  S: string[][];
  M: string[][][];
  P: string[][][];
}

interface PoseidonConsts {
  C: bigint[];
  S: bigint[];
  M: bigint[][];
  P: bigint[][];
}

let _raw: RawConsts | null = null;
const _cache = new Map<number, PoseidonConsts>();

async function loadRaw(): Promise<RawConsts> {
  if (_raw) return _raw;
  // Use pathToFileURL to bypass circomlibjs package exports restriction
  const abs = resolve("node_modules/circomlibjs/src/poseidon_constants_opt.js");
  const url = pathToFileURL(abs).href;
  const mod = await import(url);
  _raw = (mod.default ?? mod) as RawConsts;
  return _raw;
}

async function getConstants(t: number): Promise<PoseidonConsts> {
  if (_cache.has(t)) return _cache.get(t)!;
  const raw = await loadRaw();
  const idx = t - 2;
  const toBI = (x: string) => BigInt(x);
  const consts: PoseidonConsts = {
    C: raw.C[idx].map(toBI),
    S: raw.S[idx].map(toBI),
    M: raw.M[idx].map((row) => row.map(toBI)),
    P: raw.P[idx].map((row) => row.map(toBI)),
  };
  _cache.set(t, consts);
  return consts;
}

// ── Optimised Poseidon sponge ─────────────────────────────────────────────────
// Mirrors poseidon_opt.js from circomlibjs but with BLS12-381 field arithmetic.

export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const t = inputs.length + 1;
  const nRoundsP = N_ROUNDS_P[t - 2];
  const { C, S, M, P } = await getConstants(t);

  let state: bigint[] = [0n, ...inputs.map(fmod)];
  for (let i = 0; i < t; i++) state[i] = fadd(state[i], C[i]);

  // Full rounds (first half minus one)
  for (let r = 0; r < N_ROUNDS_F / 2 - 1; r++) {
    state = state.map(fpow5);
    state = state.map((a, i) => fadd(a, C[(r + 1) * t + i]));
    state = state.map((_, i) =>
      state.reduce((acc, a, j) => fadd(acc, fmul(M[j][i], a)), 0n),
    );
  }

  // Transition full round — use P matrix (optimisation)
  state = state.map(fpow5);
  state = state.map((a, i) => fadd(a, C[(N_ROUNDS_F / 2) * t + i]));
  state = state.map((_, i) =>
    state.reduce((acc, a, j) => fadd(acc, fmul(P[j][i], a)), 0n),
  );

  // Partial rounds (sparse S matrix)
  for (let r = 0; r < nRoundsP; r++) {
    state[0] = fpow5(state[0]);
    state[0] = fadd(state[0], C[(N_ROUNDS_F / 2 + 1) * t + r]);
    const s0 = state.reduce(
      (acc, a, j) => fadd(acc, fmul(S[(t * 2 - 1) * r + j], a)),
      0n,
    );
    for (let k = 1; k < t; k++) {
      state[k] = fadd(state[k], fmul(state[0], S[(t * 2 - 1) * r + t + k - 1]));
    }
    state[0] = s0;
  }

  // Full rounds (second half minus one)
  for (let r = 0; r < N_ROUNDS_F / 2 - 1; r++) {
    state = state.map(fpow5);
    state = state.map((a, i) =>
      fadd(a, C[(N_ROUNDS_F / 2 + 1) * t + nRoundsP + r * t + i]),
    );
    state = state.map((_, i) =>
      state.reduce((acc, a, j) => fadd(acc, fmul(M[j][i], a)), 0n),
    );
  }

  // Final full round (no ARK)
  state = state.map(fpow5);
  state = state.map((_, i) =>
    state.reduce((acc, a, j) => fadd(acc, fmul(M[j][i], a)), 0n),
  );

  return state[0];
}

/**
 * leaf = Poseidon(secret, disbursement_id, claimant_address, expires_at, issuer_key_id)
 *
 * claimantAddress must be the 31-byte (248-bit) field encoding of the Stellar wallet:
 *   StrKey.decodeEd25519PublicKey(address).slice(1) → BigInt
 * This matches how prover.ts encodes claimant_address before passing it to snarkjs.
 */
export async function computeLeaf(
  secret: bigint,
  disbursementId: bigint,
  claimantAddress: bigint,
  expiresAt: bigint,
  issuerKeyId: bigint,
): Promise<bigint> {
  return poseidonHash([secret, disbursementId, claimantAddress, expiresAt, issuerKeyId]);
}

// ── Stellar address → field element ──────────────────────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(s: string): Buffer {
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = BASE32_ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`Invalid base32 char: ${ch}`);
    buf = (buf << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buf >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Converts a Stellar G... address to a 248-bit BLS12-381 field element (bigint).
 * Mirrors stellarAddressToField in apps/web/src/lib/constants.ts without the SDK dep.
 *
 * StrKey decodes to 35 bytes: version(1) + key(32) + checksum(2)
 * We take key[1..31] (= decoded[2..32]) as 31 bytes → 248-bit field element.
 */
export function stellarAddressToFieldBigint(address: string): bigint {
  const decoded = base32Decode(address); // 35 bytes
  const fieldBytes = decoded.subarray(2, 33); // key bytes [1..31] → 31 bytes
  const hex = Buffer.from(fieldBytes).toString('hex');
  return BigInt('0x' + hex.padStart(64, '0'));
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
