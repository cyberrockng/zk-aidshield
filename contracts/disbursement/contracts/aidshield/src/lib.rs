#![no_std]
#![allow(deprecated)]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, symbol_short,
    token, xdr::ToXdr, Address, Bytes, BytesN, Env, Vec,
};

mod test;

// ── Verifier cross-contract interface ────────────────────────────────────────

#[contractclient(name = "VerifierClient")]
pub trait VerifierInterface {
    fn verify(env: Env, proof: Bytes, public_inputs: Bytes) -> bool;
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    DisbursementId,
    MerkleRoot,
    PayoutAmount,
    ClaimedCount,
    TokenAddress,
    VerifierAddress,
    UsedNullifier(BytesN<32>),
    ActiveIssuer(BytesN<32>),
    ActiveVendor(Address),
    ActiveGovernor(Address),
    GovernanceThreshold,
    Initialized,
    Paused,
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

#[contracttype]
#[derive(Clone, Debug)]
pub struct VoucherEvent {
    pub disbursement_id: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub claimant: Address,
    pub vendor: Address,
    pub amount: i128,
}

/// Public inputs matching the circom circuit declaration order:
///   disbursement_id, merkle_root, nullifier, claimant_address, expires_at, issuer_key_id
///
/// `claimant_address_field` is the 31-byte encoding of the beneficiary's Ed25519 key
/// (bytes[1..32] of the raw public key, zero-padded to 32 bytes) so that the
/// value lies within the BLS12-381 scalar field. This matches `stellarAddressToField()`
/// in the TypeScript frontend.
#[contracttype]
#[derive(Clone, Debug)]
pub struct ProofPublicInputs {
    pub claimant_address_field: BytesN<32>,
    pub disbursement_id: BytesN<32>,
    pub expires_at: u64,
    pub issuer_key_id: BytesN<32>,
    pub merkle_root: BytesN<32>,
    pub nullifier: BytesN<32>,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct AidShieldContract;

#[contractimpl]
impl AidShieldContract {
    fn empty_cosigners(env: &Env) -> Vec<Address> {
        Vec::<Address>::new(env)
    }

    fn require_governance(env: &Env, co_signers: Vec<Address>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let threshold: u32 = env.storage()
            .instance()
            .get(&DataKey::GovernanceThreshold)
            .unwrap_or(1);
        if threshold <= 1 {
            return;
        }

        let mut approvals = 1u32;
        let mut seen = Vec::<Address>::new(env);

        for signer in co_signers.iter() {
            if signer == admin {
                panic!("Admin already counted");
            }
            for existing in seen.iter() {
                if existing == signer {
                    panic!("Duplicate governor signer");
                }
            }
            let active: bool = env.storage()
                .persistent()
                .get(&DataKey::ActiveGovernor(signer.clone()))
                .unwrap_or(false);
            if !active {
                panic!("Governor signer is not active");
            }
            signer.require_auth();
            seen.push_back(signer);
            approvals += 1;
        }

        if approvals < threshold {
            panic!("Governance threshold not met");
        }
    }

    /// Initialise a disbursement campaign.
    ///
    /// token_address    — Stellar Asset Contract for the payout token (XLM SAC)
    /// verifier_address — deployed AidShieldVerifier contract
    pub fn initialize(
        env: Env,
        admin: Address,
        disbursement_id: BytesN<32>,
        merkle_root: BytesN<32>,
        payout_amount: i128,
        token_address: Address,
        verifier_address: Address,
    ) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::DisbursementId, &disbursement_id);
        env.storage().instance().set(&DataKey::MerkleRoot, &merkle_root);
        env.storage().instance().set(&DataKey::PayoutAmount, &payout_amount);
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
        env.storage().instance().set(&DataKey::VerifierAddress, &verifier_address);
        env.storage().instance().set(&DataKey::ClaimedCount, &0u32);
        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().set(&DataKey::GovernanceThreshold, &1u32);

        // Keep instance storage alive for ~30 days (30d × 24h × 720 ledgers/h = 518 400)
        env.storage().instance().extend_ttl(518_400, 518_400);
    }

    /// Deposit XLM into the escrow via the Stellar Asset Contract.
    /// The funder authorises this invocation; the Soroban auth tree propagates
    /// that authorisation into the sub-invocation of token.transfer.
    pub fn fund(env: Env, funder: Address, amount: i128) {
        funder.require_auth();
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic!("Not initialized");
        }
        let token_address: Address = env.storage().instance()
            .get(&DataKey::TokenAddress).unwrap();
        token::Client::new(&env, &token_address)
            .transfer(&funder, &env.current_contract_address(), &amount);
    }

    /// Beneficiary submits a ZK proof to claim their payout.
    ///
    /// Enforces:
    ///   1. Groth16 proof passes on-chain verification
    ///   2. disbursement_id matches this campaign
    ///   3. merkle_root matches stored root
    ///   4. nullifier has never been used (replay protection)
    ///   5. Payout released via real XLM SAC transfer
    ///
    /// `proof`          — 384-byte Groth16 proof generated by snarkjs/circom
    /// `public_inputs`  — public witness (disbursement_id, merkle_root, nullifier,
    ///                    claimant_address_field, expires_at, issuer_key_id) matching the circuit's pub inputs
    /// Admin kill-switch: set paused=true to halt claims, false to re-enable.
    pub fn set_paused(env: Env, paused: bool) {
        Self::require_governance(&env, Self::empty_cosigners(&env));
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    pub fn set_paused_gov(env: Env, paused: bool, co_signers: Vec<Address>) {
        Self::require_governance(&env, co_signers);
        env.storage().instance().set(&DataKey::Paused, &paused);
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&DataKey::Paused).unwrap_or(true)
    }

    /// Update the verifier contract address (admin only). Allows hot-swapping
    /// the verifier without redeploying the disbursement contract.
    pub fn set_verifier(env: Env, verifier_address: Address) {
        Self::require_governance(&env, Self::empty_cosigners(&env));
        env.storage().instance().set(&DataKey::VerifierAddress, &verifier_address);
    }

    pub fn set_verifier_gov(env: Env, verifier_address: Address, co_signers: Vec<Address>) {
        Self::require_governance(&env, co_signers);
        env.storage().instance().set(&DataKey::VerifierAddress, &verifier_address);
    }

    /// Add an issuer key id that is allowed to back campaign credentials.
    /// The key id is a 32-byte BLS12-381 field element, normally derived from
    /// the issuer's Stellar public key using stellarAddressToField().
    pub fn add_issuer(env: Env, issuer_key_id: BytesN<32>) {
        Self::require_governance(&env, Self::empty_cosigners(&env));
        env.storage().persistent().set(&DataKey::ActiveIssuer(issuer_key_id.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::ActiveIssuer(issuer_key_id),
            518_400,
            518_400,
        );
    }

    pub fn add_issuer_gov(env: Env, issuer_key_id: BytesN<32>, co_signers: Vec<Address>) {
        Self::require_governance(&env, co_signers);
        env.storage().persistent().set(&DataKey::ActiveIssuer(issuer_key_id.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::ActiveIssuer(issuer_key_id),
            518_400,
            518_400,
        );
    }

    /// Revoke an issuer key id. New claims bound to that issuer will fail even
    /// if the ZK proof and Merkle path are otherwise valid.
    pub fn revoke_issuer(env: Env, issuer_key_id: BytesN<32>) {
        Self::require_governance(&env, Self::empty_cosigners(&env));
        env.storage().persistent().set(&DataKey::ActiveIssuer(issuer_key_id), &false);
    }

    pub fn revoke_issuer_gov(env: Env, issuer_key_id: BytesN<32>, co_signers: Vec<Address>) {
        Self::require_governance(&env, co_signers);
        env.storage().persistent().set(&DataKey::ActiveIssuer(issuer_key_id), &false);
    }

    pub fn is_issuer_active(env: Env, issuer_key_id: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::ActiveIssuer(issuer_key_id))
            .unwrap_or(false)
    }

    /// Add an approved vendor that can receive restricted aid redemptions.
    pub fn add_vendor(env: Env, vendor: Address) {
        Self::require_governance(&env, Self::empty_cosigners(&env));
        env.storage().persistent().set(&DataKey::ActiveVendor(vendor.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::ActiveVendor(vendor),
            518_400,
            518_400,
        );
    }

    pub fn add_vendor_gov(env: Env, vendor: Address, co_signers: Vec<Address>) {
        Self::require_governance(&env, co_signers);
        env.storage().persistent().set(&DataKey::ActiveVendor(vendor.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::ActiveVendor(vendor),
            518_400,
            518_400,
        );
    }

    /// Revoke an approved vendor. Future voucher redemptions to this address fail.
    pub fn revoke_vendor(env: Env, vendor: Address) {
        Self::require_governance(&env, Self::empty_cosigners(&env));
        env.storage().persistent().set(&DataKey::ActiveVendor(vendor), &false);
    }

    pub fn revoke_vendor_gov(env: Env, vendor: Address, co_signers: Vec<Address>) {
        Self::require_governance(&env, co_signers);
        env.storage().persistent().set(&DataKey::ActiveVendor(vendor), &false);
    }

    pub fn is_vendor_active(env: Env, vendor: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::ActiveVendor(vendor))
            .unwrap_or(false)
    }

    pub fn claim(
        env: Env,
        claimant: Address,
        public_inputs: ProofPublicInputs,
        proof: Bytes,
    ) {
        Self::execute_claim(env, claimant.clone(), claimant, public_inputs, proof, None);
    }

    /// Beneficiary authorizes the same private eligibility proof, but the payout
    /// is sent to an approved vendor. This supports restricted aid budgets
    /// without exposing the beneficiary list or credential witness.
    pub fn claim_to_vendor(
        env: Env,
        claimant: Address,
        vendor: Address,
        public_inputs: ProofPublicInputs,
        proof: Bytes,
    ) {
        let vendor_active: bool = env.storage()
            .persistent()
            .get(&DataKey::ActiveVendor(vendor.clone()))
            .unwrap_or(false);
        if !vendor_active {
            panic!("Vendor is not active");
        }
        Self::execute_claim(env, claimant, vendor.clone(), public_inputs, proof, Some(vendor));
    }

    fn execute_claim(
        env: Env,
        claimant: Address,
        payout_recipient: Address,
        public_inputs: ProofPublicInputs,
        proof: Bytes,
        vendor: Option<Address>,
    ) {
        claimant.require_auth();

        if !env.storage().instance().has(&DataKey::Initialized) {
            panic!("Contract not initialized");
        }

        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(true);
        if paused {
            panic!("Claims are paused");
        }

        // ── ZK Proof verification ──────────────────────────────────────────
        // Encode public inputs as 6 × 32-byte concatenation in circuit declaration order:
        //   disbursement_id | merkle_root | nullifier | claimant_address_field | expires_at | issuer_key_id
        let verifier_address: Address = env.storage().instance()
            .get(&DataKey::VerifierAddress).unwrap();

        let mut pi_bytes = Bytes::new(&env);
        pi_bytes.append(&public_inputs.disbursement_id.clone().into());
        pi_bytes.append(&public_inputs.merkle_root.clone().into());
        pi_bytes.append(&public_inputs.nullifier.clone().into());
        pi_bytes.append(&public_inputs.claimant_address_field.clone().into());
        let mut expires_at_bytes = [0u8; 32];
        expires_at_bytes[24..32].copy_from_slice(&public_inputs.expires_at.to_be_bytes());
        pi_bytes.append(&BytesN::<32>::from_array(&env, &expires_at_bytes).into());
        pi_bytes.append(&public_inputs.issuer_key_id.clone().into());

        let verifier = VerifierClient::new(&env, &verifier_address);
        if !verifier.verify(&proof, &pi_bytes) {
            panic!("ZK proof verification failed");
        }

        // ── Application-level checks ──────────────────────────────────────

        // Check 0: claimant address matches the proof's public input
        //
        // stellarAddressToField encodes a G-address as [0x00, key[1..31]] —
        // dropping key[0] keeps the value inside the BLS12-381 scalar field.
        // XDR layout for ScAddress::Account: 4B type + 4B key-type + 32B key = 40B total.
        // Ed25519 key starts at byte 8.
        {
            let claimant_xdr: Bytes = claimant.clone().to_xdr(&env);
            // Test env serialises ScAddress directly (40 B, key at offset 8).
            // Production host serialises ScVal::ScvAddress(ScAddress) (44 B, key at offset 12).
            // XDR layout (production): 4B SCV_ADDRESS tag + 4B account type + 4B key type + 32B key
            // XDR layout (test env):                         4B account type + 4B key type + 32B key
            let key_offset: u32 = if claimant_xdr.len() == 44 { 12 } else { 8 };
            if claimant_xdr.len() < key_offset + 32 {
                panic!("Claimant must be an Ed25519 account address");
            }
            // stellarAddressToField drops key[0] (for field safety) and left-pads with 0x00
            let mut expected = [0u8; 32];
            for i in 1u32..32u32 {
                expected[i as usize] = claimant_xdr.get_unchecked(key_offset + i);
            }
            let expected_field = BytesN::<32>::from_array(&env, &expected);
            if public_inputs.claimant_address_field != expected_field {
                panic!("Claimant address does not match proof: proof was generated for a different wallet");
            }
        }

        // Check 1: disbursement_id
        let stored_id: BytesN<32> = env.storage().instance()
            .get(&DataKey::DisbursementId).unwrap();
        if public_inputs.disbursement_id != stored_id {
            panic!("Wrong disbursement_id");
        }

        // Check 2: merkle_root
        let stored_root: BytesN<32> = env.storage().instance()
            .get(&DataKey::MerkleRoot).unwrap();
        if public_inputs.merkle_root != stored_root {
            panic!("Merkle root mismatch");
        }

        // Check 3: issuer must still be active
        let issuer_key = DataKey::ActiveIssuer(public_inputs.issuer_key_id.clone());
        let issuer_active: bool = env.storage().persistent().get(&issuer_key).unwrap_or(false);
        if !issuer_active {
            panic!("Credential issuer is not active");
        }

        // Check 4: credential must not be expired by ledger time
        if env.ledger().timestamp() > public_inputs.expires_at {
            panic!("Credential expired");
        }

        // Check 5: replay protection — nullifier must be fresh
        let nullifier_key = DataKey::UsedNullifier(public_inputs.nullifier.clone());
        if env.storage().persistent().has(&nullifier_key) {
            panic!("Nullifier already used: replay attack blocked");
        }

        // ── Payout via XLM SAC ────────────────────────────────────────────
        let payout: i128 = env.storage().instance()
            .get(&DataKey::PayoutAmount).unwrap();
        let token_address: Address = env.storage().instance()
            .get(&DataKey::TokenAddress).unwrap();
        token::Client::new(&env, &token_address)
            .transfer(&env.current_contract_address(), &payout_recipient, &payout);

        // ── State updates ─────────────────────────────────────────────────
        env.storage().persistent().set(&nullifier_key, &true);
        // Extend nullifier TTL so replay protection survives archival (~30 days)
        env.storage().persistent().extend_ttl(&nullifier_key, 518_400, 518_400);

        let count: u32 = env.storage().instance()
            .get(&DataKey::ClaimedCount).unwrap_or(0);
        env.storage().instance().set(&DataKey::ClaimedCount, &(count + 1));
        // Refresh instance storage TTL on every claim
        env.storage().instance().extend_ttl(518_400, 518_400);

        match vendor {
            Some(vendor_addr) => {
                env.events().publish(
                    (symbol_short!("voucher"), symbol_short!("redeemed")),
                    VoucherEvent {
                        disbursement_id: public_inputs.disbursement_id,
                        nullifier: public_inputs.nullifier,
                        claimant,
                        vendor: vendor_addr,
                        amount: payout,
                    },
                );
            }
            None => {
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
        }
    }

    /// Returns live campaign stats. Escrow balance is read directly from the token SAC.
    pub fn stats(env: Env) -> CampaignStats {
        let token_address: Address = env.storage().instance()
            .get(&DataKey::TokenAddress).unwrap();
        let escrow_balance = token::Client::new(&env, &token_address)
            .balance(&env.current_contract_address());

        CampaignStats {
            disbursement_id: env.storage().instance().get(&DataKey::DisbursementId).unwrap(),
            merkle_root: env.storage().instance().get(&DataKey::MerkleRoot).unwrap(),
            payout_amount: env.storage().instance().get(&DataKey::PayoutAmount).unwrap(),
            escrow_balance,
            claimed_count: env.storage().instance().get(&DataKey::ClaimedCount).unwrap_or(0),
        }
    }

    /// Returns true if the given nullifier has already been used.
    pub fn is_nullifier_used(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::UsedNullifier(nullifier))
    }

    /// Admin can rotate the Merkle root for a new beneficiary list.
    /// Emits a `root.updated` event containing the new root for auditor visibility.
    pub fn update_root(env: Env, new_root: BytesN<32>) {
        Self::require_governance(&env, Self::empty_cosigners(&env));
        Self::write_root_update(&env, new_root);
    }

    pub fn update_root_gov(env: Env, new_root: BytesN<32>, co_signers: Vec<Address>) {
        Self::require_governance(&env, co_signers);
        Self::write_root_update(&env, new_root);
    }

    fn write_root_update(env: &Env, new_root: BytesN<32>) {
        let old_root: BytesN<32> = env.storage().instance()
            .get(&DataKey::MerkleRoot).unwrap();
        env.storage().instance().set(&DataKey::MerkleRoot, &new_root);
        env.events().publish(
            (symbol_short!("root"), symbol_short!("updated")),
            (old_root, new_root),
        );
    }

    /// Add or revoke a governor and set the signature threshold required for
    /// sensitive admin operations. The admin signature always counts as one.
    pub fn set_governance(env: Env, governor: Address, active: bool, threshold: u32, co_signers: Vec<Address>) {
        if threshold < 1 {
            panic!("Governance threshold must be at least 1");
        }
        Self::require_governance(&env, co_signers);
        env.storage().persistent().set(&DataKey::ActiveGovernor(governor.clone()), &active);
        if active {
            env.storage().persistent().extend_ttl(
                &DataKey::ActiveGovernor(governor),
                518_400,
                518_400,
            );
        }
        env.storage().instance().set(&DataKey::GovernanceThreshold, &threshold);
        env.events().publish(
            (symbol_short!("governor"), symbol_short!("updated")),
            threshold,
        );
    }

    pub fn is_governor_active(env: Env, governor: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::ActiveGovernor(governor))
            .unwrap_or(false)
    }

    pub fn governance_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::GovernanceThreshold)
            .unwrap_or(1)
    }
}
