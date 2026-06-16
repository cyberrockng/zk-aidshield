#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env,
};

mod test;

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    DisbursementId,
    MerkleRoot,
    PayoutAmount,
    EscrowBalance,
    ClaimedCount,
    UsedNullifier(BytesN<32>),
    Initialized,
}

// ── Shared types ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CampaignStats {
    pub disbursement_id: BytesN<32>,
    pub merkle_root: BytesN<32>,
    pub payout_amount: i128,
    pub escrow_balance: i128,
    pub claimed_count: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct ClaimEvent {
    pub disbursement_id: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub claimant: Address,
    pub amount: i128,
}

/// Public inputs from the ZK proof — submitted alongside the serialised proof bytes.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ProofPublicInputs {
    pub disbursement_id: BytesN<32>,
    pub merkle_root: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub claimant_address: Address,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct AidShieldContract;

#[contractimpl]
impl AidShieldContract {

    /// Admin initialises a disbursement campaign.
    /// disbursement_id — unique campaign identifier
    /// merkle_root     — Pedersen Merkle root of the approved beneficiary list
    /// payout_amount   — fixed stipend per valid claim (in stroops: 1 XLM = 10_000_000)
    pub fn initialize(
        env: Env,
        admin: Address,
        disbursement_id: BytesN<32>,
        merkle_root: BytesN<32>,
        payout_amount: i128,
    ) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::DisbursementId, &disbursement_id);
        env.storage().instance().set(&DataKey::MerkleRoot, &merkle_root);
        env.storage().instance().set(&DataKey::PayoutAmount, &payout_amount);
        env.storage().instance().set(&DataKey::EscrowBalance, &0i128);
        env.storage().instance().set(&DataKey::ClaimedCount, &0u32);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    /// Admin deposits funds into the escrow so payouts can be released.
    pub fn fund(env: Env, funder: Address, amount: i128) {
        funder.require_auth();
        let current: i128 = env.storage().instance()
            .get(&DataKey::EscrowBalance).unwrap_or(0);
        env.storage().instance().set(&DataKey::EscrowBalance, &(current + amount));
    }

    /// Beneficiary submits a ZK proof to claim their payout.
    ///
    /// Enforces:
    ///   1. disbursement_id matches this campaign
    ///   2. merkle_root matches stored root
    ///   3. claimant_address matches tx submitter (address binding)
    ///   4. nullifier has never been used (replay protection)
    ///   5. sufficient escrow balance
    ///
    /// `_proof` — serialised UltraHonk proof bytes (verified by on-chain
    ///            Noir verifier contract in production; accepted structurally here)
    pub fn claim(
        env: Env,
        claimant: Address,
        public_inputs: ProofPublicInputs,
        _proof: BytesN<64>,
    ) {
        claimant.require_auth();

        if !env.storage().instance().has(&DataKey::Initialized) {
            panic!("Contract not initialized");
        }

        // Check 1: disbursement_id matches
        let stored_id: BytesN<32> = env.storage().instance()
            .get(&DataKey::DisbursementId).unwrap();
        if public_inputs.disbursement_id != stored_id {
            panic!("Wrong disbursement_id");
        }

        // Check 2: merkle_root matches
        let stored_root: BytesN<32> = env.storage().instance()
            .get(&DataKey::MerkleRoot).unwrap();
        if public_inputs.merkle_root != stored_root {
            panic!("Merkle root mismatch");
        }

        // Check 3: claimant_address matches tx submitter (address binding)
        if public_inputs.claimant_address != claimant {
            panic!("Address mismatch: proof bound to different wallet");
        }

        // Check 4: replay protection — nullifier must be fresh
        let nullifier_key = DataKey::UsedNullifier(public_inputs.nullifier.clone());
        if env.storage().persistent().has(&nullifier_key) {
            panic!("Nullifier already used: replay attack blocked");
        }

        // Check 5: sufficient escrow
        let payout: i128 = env.storage().instance()
            .get(&DataKey::PayoutAmount).unwrap();
        let balance: i128 = env.storage().instance()
            .get(&DataKey::EscrowBalance).unwrap();
        if balance < payout {
            panic!("Insufficient escrow balance");
        }

        // Mark nullifier used (persistent storage survives ledger closings)
        env.storage().persistent().set(&nullifier_key, &true);

        // Update escrow balance and claim count
        env.storage().instance().set(&DataKey::EscrowBalance, &(balance - payout));
        let count: u32 = env.storage().instance()
            .get(&DataKey::ClaimedCount).unwrap_or(0);
        env.storage().instance().set(&DataKey::ClaimedCount, &(count + 1));

        // Emit public event — nullifier + campaign only, zero PII
        env.events().publish(
            (symbol_short!("claim"), symbol_short!("paid")),
            ClaimEvent {
                disbursement_id: public_inputs.disbursement_id,
                nullifier: public_inputs.nullifier,
                claimant,
                amount: payout,
            },
        );
    }

    /// Returns campaign statistics — no beneficiary data exposed.
    pub fn stats(env: Env) -> CampaignStats {
        CampaignStats {
            disbursement_id: env.storage().instance().get(&DataKey::DisbursementId).unwrap(),
            merkle_root: env.storage().instance().get(&DataKey::MerkleRoot).unwrap(),
            payout_amount: env.storage().instance().get(&DataKey::PayoutAmount).unwrap(),
            escrow_balance: env.storage().instance().get(&DataKey::EscrowBalance).unwrap(),
            claimed_count: env.storage().instance().get(&DataKey::ClaimedCount).unwrap_or(0),
        }
    }

    /// Returns true if a nullifier has already been used.
    pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::UsedNullifier(nullifier))
    }

    /// Admin can rotate the Merkle root for a new beneficiary list.
    pub fn update_root(env: Env, new_root: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::MerkleRoot, &new_root);
    }
}
