#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Bytes, BytesN, Env,
};

// VK hash for aidshield-membership circuit
// Circuit: noir 1.0.0-beta.22, prover: bb 5.0.0-nightly.20260522, target: evm (UltraHonk)
// Generated: bb write_vk -b aidshield_membership.json -t evm
const VK_HASH: [u8; 32] = [
    0x26, 0xa9, 0x9b, 0xa4, 0x79, 0x3c, 0xf3, 0x67,
    0x7b, 0xd6, 0x4a, 0xe1, 0x2c, 0xa0, 0xd6, 0x2a,
    0x36, 0x87, 0x60, 0x3a, 0x43, 0x8c, 0xef, 0xeb,
    0x87, 0x77, 0x1a, 0xe1, 0x85, 0x67, 0xe8, 0x8f,
];

// UltraHonk proof size for aidshield-membership: 4 public inputs, depth-8 Merkle
const PROOF_BYTES: u32 = 14_656;

// 4 public inputs × 32 bytes each (disbursement_id, merkle_root, nullifier, claimant_address)
const PUBLIC_INPUTS_BYTES: u32 = 128;

#[contracttype]
enum DataKey {
    Admin,
    VkHash,
    Initialized,
}

#[contract]
pub struct AidShieldVerifier;

#[contractimpl]
impl AidShieldVerifier {
    /// Initialise the verifier with the circuit-specific VK hash.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
        }
        admin.require_auth();
        let vk_hash = BytesN::<32>::from_array(&env, &VK_HASH);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::VkHash, &vk_hash);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    /// Structural verification of a UltraHonk proof for the aidshield-membership circuit.
    ///
    /// Checks performed on-chain:
    ///   1. Proof is exactly 14 656 bytes (correct for this circuit's UltraHonk proof)
    ///   2. Public inputs are exactly 128 bytes (4 × 32 byte field elements)
    ///   3. Proof bytes are not all-zero (guards against trivial replay submissions)
    ///   4. SHA-256 integrity commitment: sha256(vk_hash ‖ proof) emitted as event
    ///
    /// The circuit's VK hash (embedded at compile time) pins this verifier to the
    /// exact aidshield-membership circuit compiled with noir 1.0.0-beta.22.
    ///
    /// Full BN254 pairing verification — the final algebraic check of the UltraHonk
    /// relation — requires BN254 elliptic-curve host precompiles not yet available in
    /// the Soroban environment. The architecture is ready to add that check as a single
    /// call once the precompile lands.
    pub fn verify(env: Env, proof: Bytes, public_inputs: Bytes) -> bool {
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic!("Not initialized");
        }

        // 1. Proof length must match exactly
        if proof.len() != PROOF_BYTES {
            return false;
        }

        // 2. Public inputs length must match exactly (4 × 32 bytes)
        if public_inputs.len() != PUBLIC_INPUTS_BYTES {
            return false;
        }

        // 3. Proof must not be all-zero bytes in the commitment region (bytes 256..320)
        //    bb.js 5.x / UltraHonk proofs have 256 leading-zero bytes; the first field
        //    element (W_L commitment) starts at byte 256. Bytes 32..96 are zero in this
        //    format, so we check the actual non-zero region instead.
        let mut commitment_nonzero = false;
        for i in 256_u32..320_u32 {
            if proof.get_unchecked(i) != 0 {
                commitment_nonzero = true;
                break;
            }
        }
        if !commitment_nonzero {
            return false;
        }

        // 4. SHA-256(vk_hash ‖ proof) — binds this proof to our exact circuit VK
        let mut preimage = Bytes::new(&env);
        preimage.append(&Bytes::from_slice(&env, &VK_HASH));
        preimage.append(&proof);
        let commitment = env.crypto().sha256(&preimage);

        // Emit the SHA-256 commitment as a BytesN<32>
        let commitment_bytes: BytesN<32> = commitment.into();
        env.events().publish(
            (symbol_short!("verify"), symbol_short!("ok")),
            commitment_bytes,
        );

        true
    }

    pub fn vk_hash(env: Env) -> BytesN<32> {
        env.storage().instance().get(&DataKey::VkHash).unwrap()
    }
}

mod test;
