#![no_std]

//! AidShield Groth16 Verifier (BLS12-381)
//!
//! Performs a full cryptographic Groth16 pairing check on-chain using Soroban's
//! native BLS12-381 host functions. A forged proof that does not satisfy the circuit
//! constraints cannot pass — the multi-pairing check is computationally binding.
//!
//! Groth16 verification equation:
//!   e(A, B) · e(−α, β) · e(−vk_x, γ) · e(−C, δ) == 1_GT
//!
//! Where:
//!   A, C       = proof G1 points (pi_a, pi_c)
//!   B          = proof G2 point (pi_b)
//!   α, β, γ, δ = verification key points (stored in contract)
//!   vk_x       = IC[0] + Σ public_input[i] * IC[i+1]  (linear combination)
//!
//! Public inputs (6 × 32 bytes = 192 bytes total):
//!   disbursement_id | merkle_root | nullifier | claimant_address_field | expires_at | issuer_key_id
//!
//! Proof layout (pi_a‖pi_b‖pi_c) — Soroban uncompressed affine:
//!   pi_a: 96 bytes  (G1: X[48] || Y[48])
//!   pi_b: 192 bytes (G2: X_c1[48] || X_c0[48] || Y_c1[48] || Y_c0[48])
//!   pi_c: 96 bytes  (G1: X[48] || Y[48])
//!   Total: 384 bytes

use soroban_sdk::{
    contract, contractimpl, contracttype,
    crypto::bls12_381::{Bls12381Fr, Bls12381G1Affine, Bls12381G2Affine},
    Bytes, BytesN, Env, Vec,
};

// G1/G2 use **uncompressed** affine encoding:
//   G1: be_bytes(X, 48) || be_bytes(Y, 48)  = 96 bytes
//   G2: be_bytes(X_c1, 48) || be_bytes(X_c0, 48) || be_bytes(Y_c1, 48) || be_bytes(Y_c0, 48)  = 192 bytes
// Negation uses soroban_sdk's Neg impl (negates the Y coordinate mod p).

const G1_SIZE: u32 = 96;
const G2_SIZE: u32 = 192;
const FR_SIZE: u32 = 32;
const PROOF_SIZE: u32 = G1_SIZE + G2_SIZE + G1_SIZE; // 384
const PI_SIZE: u32 = 6 * FR_SIZE;                    // 192
const N_PUBLIC: u32 = 6;                              // disbursement_id, merkle_root, nullifier, claimant_address, expires_at, issuer

#[contracttype]
pub enum DataKey {
    VkAlpha,
    VkBeta,
    VkGamma,
    VkDelta,
    VkIc,
    Initialized,
}

#[contract]
pub struct Groth16Verifier;

#[contractimpl]
impl Groth16Verifier {
    /// Store the verification key on-chain at deployment.
    ///
    /// vk_alpha:  96-byte uncompressed G1 (X[48] || Y[48])
    /// vk_beta:   192-byte uncompressed G2
    /// vk_gamma:  192-byte uncompressed G2
    /// vk_delta:  192-byte uncompressed G2
    /// vk_ic:     (N_PUBLIC+1) × 96 = 672 bytes of concatenated uncompressed G1 points
    pub fn initialize(
        env: Env,
        vk_alpha: BytesN<96>,
        vk_beta:  BytesN<192>,
        vk_gamma: BytesN<192>,
        vk_delta: BytesN<192>,
        vk_ic:    Bytes,
    ) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
        }
        if vk_ic.len() != (N_PUBLIC + 1) * G1_SIZE {
            panic!("vk_ic must be (N_PUBLIC+1) * 96 bytes");
        }
        env.storage().instance().set(&DataKey::VkAlpha, &vk_alpha);
        env.storage().instance().set(&DataKey::VkBeta,  &vk_beta);
        env.storage().instance().set(&DataKey::VkGamma, &vk_gamma);
        env.storage().instance().set(&DataKey::VkDelta, &vk_delta);
        env.storage().instance().set(&DataKey::VkIc,    &vk_ic);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().extend_ttl(518_400, 518_400);
    }

    /// Verify a Groth16 proof against the stored VK.
    ///
    /// proof:         384 bytes — pi_a(96) ‖ pi_b(192) ‖ pi_c(96)
    /// public_inputs: 192 bytes — disbursement_id ‖ merkle_root ‖ nullifier ‖ claimant_address ‖ expires_at ‖ issuer_key_id
    ///
    /// Returns true iff the multi-pairing check passes.
    pub fn verify(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        if proof.len() != PROOF_SIZE || public_inputs.len() != PI_SIZE {
            return false;
        }

        let bls = env.crypto().bls12_381();

        // ── Parse proof ──────────────────────────────────────────────────
        let pi_a = extract_g1(&env, &proof, 0);
        let pi_b = extract_g2(&env, &proof, G1_SIZE);
        let pi_c = extract_g1(&env, &proof, G1_SIZE + G2_SIZE);

        // ── Load verification key ─────────────────────────────────────────
        let vk_alpha: BytesN<96>  = env.storage().instance().get(&DataKey::VkAlpha).unwrap();
        let vk_beta:  BytesN<192> = env.storage().instance().get(&DataKey::VkBeta).unwrap();
        let vk_gamma: BytesN<192> = env.storage().instance().get(&DataKey::VkGamma).unwrap();
        let vk_delta: BytesN<192> = env.storage().instance().get(&DataKey::VkDelta).unwrap();
        let vk_ic_raw: Bytes      = env.storage().instance().get(&DataKey::VkIc).unwrap();

        let alpha = Bls12381G1Affine::from_bytes(vk_alpha);
        let beta  = Bls12381G2Affine::from_bytes(vk_beta);
        let gamma = Bls12381G2Affine::from_bytes(vk_gamma);
        let delta = Bls12381G2Affine::from_bytes(vk_delta);

        // ── Compute vk_x = IC[0] + MSM(IC[1..N_PUBLIC+1], public_inputs) ─
        let ic0 = extract_g1(&env, &vk_ic_raw, 0);

        let ic_points: Vec<Bls12381G1Affine> = {
            let mut v = Vec::new(&env);
            for i in 1u32..=N_PUBLIC {
                v.push_back(extract_g1(&env, &vk_ic_raw, i * G1_SIZE));
            }
            v
        };

        let pi_scalars: Vec<Bls12381Fr> = {
            let mut v = Vec::new(&env);
            for i in 0u32..N_PUBLIC {
                v.push_back(extract_fr(&env, &public_inputs, i * FR_SIZE));
            }
            v
        };

        let msm = bls.g1_msm(ic_points, pi_scalars);
        let vk_x = bls.g1_add(&ic0, &msm);

        // ── Build pairing inputs: e(A,B)·e(−α,β)·e(−vk_x,γ)·e(−C,δ)==1 ─
        let g1s: Vec<Bls12381G1Affine> = {
            let mut v = Vec::new(&env);
            v.push_back(pi_a);
            v.push_back(-alpha);   // Neg::neg negates Y coordinate mod p (uncompressed)
            v.push_back(-vk_x);
            v.push_back(-pi_c);
            v
        };
        let g2s: Vec<Bls12381G2Affine> = {
            let mut v = Vec::new(&env);
            v.push_back(pi_b);
            v.push_back(beta);
            v.push_back(gamma);
            v.push_back(delta);
            v
        };

        bls.pairing_check(g1s, g2s)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────

fn extract_g1(env: &Env, src: &Bytes, offset: u32) -> Bls12381G1Affine {
    let mut arr = [0u8; 96];
    for i in 0..96u32 {
        arr[i as usize] = src.get_unchecked(offset + i);
    }
    Bls12381G1Affine::from_bytes(BytesN::from_array(env, &arr))
}

fn extract_g2(env: &Env, src: &Bytes, offset: u32) -> Bls12381G2Affine {
    let mut arr = [0u8; 192];
    for i in 0..192u32 {
        arr[i as usize] = src.get_unchecked(offset + i);
    }
    Bls12381G2Affine::from_bytes(BytesN::from_array(env, &arr))
}

fn extract_fr(env: &Env, src: &Bytes, offset: u32) -> Bls12381Fr {
    let mut arr = [0u8; 32];
    for i in 0..32u32 {
        arr[i as usize] = src.get_unchecked(offset + i);
    }
    Bls12381Fr::from_bytes(BytesN::from_array(env, &arr))
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn test_verify_rejects_empty_proof() {
        let env = Env::default();
        let contract_id = env.register(Groth16Verifier, ());
        let client = Groth16VerifierClient::new(&env, &contract_id);
        let proof = Bytes::new(&env);
        let pi = Bytes::new(&env);
        assert!(!client.verify(&proof, &pi));
    }
}
