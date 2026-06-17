/**
 * Poseidon hash for BLS12-381 scalar field.
 *
 * Uses the same round constants and MDS matrix as circomlib's poseidon.circom
 * (which were generated for BN254 but are valid BLS12-381 field elements since
 * BN254 prime < BLS12-381 prime). When circom compiles with --curve BLS12381,
 * the same constants appear in the constraint system but field arithmetic uses
 * the BLS12-381 prime — so this off-circuit implementation must match exactly.
 *
 * BLS12-381 scalar field prime r:
 *   0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001
 */

export const BLS12_381_R = 52435875175126190479447740508185965837690552500527637822603658699938581184513n;

// Round constants and MDS matrix sourced from circomlib poseidon_constants_opt.circom
// These are the same values used in the circuit — must stay in sync.
// Poseidon with t=3 (2 inputs), 8 full rounds + 57 partial rounds = 65 total
import { buildPoseidon } from 'circomlibjs';

let _poseidon = null;

async function getPoseidon() {
  if (!_poseidon) {
    _poseidon = await buildPoseidon();
  }
  return _poseidon;
}

/**
 * Poseidon hash in BLS12-381 field.
 * inputs: array of BigInt (field elements < BLS12_381_R)
 * returns: BigInt
 *
 * IMPORTANT: circomlibjs buildPoseidon() uses BN254 field by default.
 * For BLS12-381 we need the same arithmetic but mod BLS12-381 prime.
 * We implement this manually using the raw Poseidon sponge.
 */
export async function poseidonBLS12381(inputs) {
  // We use the circomlibjs poseidon which operates on BN254 by default.
  // Since we're compiling the circuit with --curve BLS12381, we need the hash
  // to match exactly. The approach: use circomlibjs to get the constants,
  // then re-implement the sponge mod BLS12_381_R.
  const poseidon = await getPoseidon();

  // Get the Poseidon constants from circomlibjs (BN254 constants)
  // These are the same values embedded in the compiled BLS12-381 circuit
  const F = poseidon.F; // BN254 field — we'll borrow constants but use BLS12-381 prime

  const t = inputs.length + 1; // state size
  const nRoundsF = 8;
  const nRoundsP = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68][t - 2];

  // Extract constants from circomlibjs internal state
  // circomlibjs poseidon stores C (round constants) and M (MDS matrix)
  const C = poseidon.C[t - 2];
  const M = poseidon.M[t - 2];

  // Implement sponge mod BLS12-381 prime
  const p = BLS12_381_R;
  const mod = (x) => ((x % p) + p) % p;
  const add = (a, b) => mod(a + b);
  const mul = (a, b) => mod(a * b);
  const pow5 = (x) => {
    const x2 = mul(x, x);
    const x4 = mul(x2, x2);
    return mul(x4, x);
  };

  // Convert inputs to BigInt mod BLS12-381
  let state = [0n, ...inputs.map((x) => mod(BigInt(x)))];

  // Add initial round constants
  for (let i = 0; i < t; i++) {
    state[i] = add(state[i], BigInt(F.toObject(C[i])));
  }

  let cntr = t;
  for (let r = 0; r < nRoundsF + nRoundsP; r++) {
    // S-box
    if (r < nRoundsF / 2 || r >= nRoundsF / 2 + nRoundsP) {
      // Full round: apply S-box to all elements
      for (let i = 0; i < t; i++) {
        state[i] = pow5(state[i]);
      }
    } else {
      // Partial round: apply S-box only to first element
      state[0] = pow5(state[0]);
    }

    // MDS mix
    const newState = new Array(t).fill(0n);
    for (let i = 0; i < t; i++) {
      for (let j = 0; j < t; j++) {
        newState[i] = add(newState[i], mul(BigInt(F.toObject(M[i][j])), state[j]));
      }
    }
    state = newState;

    // Add round constants (except after last round)
    if (r < nRoundsF + nRoundsP - 1) {
      for (let i = 0; i < t; i++) {
        state[i] = add(state[i], BigInt(F.toObject(C[cntr + i])));
      }
      cntr += t;
    }
  }

  return state[0];
}

/**
 * Compute leaf commitment: Poseidon(secret, disbursement_id)
 */
export async function computeLeafBLS(secret, disbursementId) {
  return poseidonBLS12381([secret, disbursementId]);
}

/**
 * Compute address-bound nullifier: Poseidon(secret, disbursement_id, claimant_address, 1)
 */
export async function computeNullifierBLS(secret, disbursementId, claimantAddress) {
  return poseidonBLS12381([secret, disbursementId, claimantAddress, 1n]);
}
