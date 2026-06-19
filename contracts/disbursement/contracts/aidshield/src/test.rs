#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, xdr::ToXdr, Address, Bytes, BytesN, Env};

// ── Mock verifier contracts ──────────────────────────────────────────────────

// Always returns true — used for happy-path tests
mod mock_verifier_ok {
    use soroban_sdk::{contract, contractimpl, Bytes, Env};

    #[contract]
    pub struct MockVerifierOk;

    #[contractimpl]
    impl MockVerifierOk {
        pub fn verify(_env: Env, _proof: Bytes, _pi: Bytes) -> bool {
            true
        }
    }
}

// Always returns false — used to test that claim rejects bad proofs
mod mock_verifier_fail {
    use soroban_sdk::{contract, contractimpl, Bytes, Env};

    #[contract]
    pub struct MockVerifierFail;

    #[contractimpl]
    impl MockVerifierFail {
        pub fn verify(_env: Env, _proof: Bytes, _pi: Bytes) -> bool {
            false
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn make_id(env: &Env, val: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[31] = val;
    BytesN::from_array(env, &bytes)
}

/// Mirrors stellarAddressToField: drops key[0], left-pads with 0x00.
/// Handles both test env (40-byte ScAddress XDR) and production (44-byte ScVal XDR).
fn addr_to_field(env: &Env, addr: &Address) -> BytesN<32> {
    let xdr = addr.to_xdr(env);
    let key_offset: u32 = if xdr.len() == 44 { 12 } else { 8 };
    let mut out = [0u8; 32];
    for i in 1u32..32u32 {
        out[i as usize] = xdr.get_unchecked(key_offset + i);
    }
    BytesN::from_array(env, &out)
}

fn make_real_proof(env: &Env) -> Bytes {
    // 384-byte Groth16 proof-shaped payload. The mock verifier accepts it; the
    // real verifier contract tests proof length and pairing behavior separately.
    let mut data = [0u8; 384];
    for i in 0..64 {
        data[i] = (i as u8).wrapping_add(1);
    }
    Bytes::from_slice(env, &data)
}

fn valid_expires_at() -> u64 {
    2_000_000_000
}

fn issuer_key(env: &Env) -> BytesN<32> {
    make_id(env, 9)
}

fn make_inputs(
    env: &Env,
    claimant: &Address,
    campaign_id: BytesN<32>,
    merkle_root: BytesN<32>,
    nullifier: BytesN<32>,
) -> ProofPublicInputs {
    ProofPublicInputs {
        claimant_address_field: addr_to_field(env, claimant),
        disbursement_id: campaign_id,
        expires_at: valid_expires_at(),
        issuer_key_id: issuer_key(env),
        merkle_root,
        nullifier,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_and_stats() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &merkle_root, &payout, &token_id, &verifier_id);

    let s = client.stats();
    assert_eq!(s.escrow_balance, 0);
    assert_eq!(s.claimed_count, 0);
    assert_eq!(s.payout_amount, payout);
    assert_eq!(s.merkle_root, merkle_root);
}

#[test]
fn test_fund_moves_real_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    client.initialize(
        &admin, &make_id(&env, 1), &make_id(&env, 2),
        &10_000_000i128, &token_id, &verifier_id,
    );
    client.fund(&admin, &100_000_000i128);

    // Escrow balance reported from real SAC balance query
    assert_eq!(client.stats().escrow_balance, 100_000_000);
}

#[test]
fn test_claim_releases_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let nullifier = make_id(&env, 3);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &merkle_root, &payout, &token_id, &verifier_id);
    client.set_paused(&false); // unpause for integration test
    client.fund(&admin, &100_000_000i128);

    let inputs = ProofPublicInputs {
        claimant_address_field: addr_to_field(&env, &claimant),
        disbursement_id: campaign_id.clone(),
        expires_at: valid_expires_at(),
        issuer_key_id: issuer_key(&env),
        merkle_root: merkle_root.clone(),
        nullifier: nullifier.clone(),
    };

    client.add_issuer(&issuer_key(&env));
    let token_client = soroban_sdk::token::TokenClient::new(&env, &token_id);
    let before = token_client.balance(&claimant);
    client.claim(&claimant, &inputs, &make_real_proof(&env));
    let after = token_client.balance(&claimant);

    assert_eq!(after - before, payout);
    assert_eq!(client.stats().claimed_count, 1);
    assert!(client.is_nullifier_used(&nullifier));
}

#[test]
#[should_panic(expected = "Claims are paused")]
fn test_paused_blocks_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &merkle_root, &payout, &token_id, &verifier_id);
    // DO NOT set_paused — contract starts paused; claim must panic
    client.fund(&admin, &100_000_000i128);

    let inputs = ProofPublicInputs {
        claimant_address_field: make_id(&env, 10),
        disbursement_id: campaign_id,
        expires_at: valid_expires_at(),
        issuer_key_id: issuer_key(&env),
        merkle_root,
        nullifier: make_id(&env, 3),
    };
    client.claim(&claimant, &inputs, &make_real_proof(&env));
}

#[test]
#[should_panic(expected = "Nullifier already used")]
fn test_replay_attack_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let nullifier = make_id(&env, 3);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &merkle_root, &payout, &token_id, &verifier_id);
    client.set_paused(&false);
    client.fund(&admin, &100_000_000i128);

    let inputs = make_inputs(&env, &claimant, campaign_id, merkle_root, nullifier);

    client.add_issuer(&issuer_key(&env));
    client.claim(&claimant, &inputs.clone(), &make_real_proof(&env));
    client.claim(&claimant, &inputs, &make_real_proof(&env)); // must panic
}

#[test]
#[should_panic(expected = "ZK proof verification failed")]
fn test_invalid_proof_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    // Use the always-failing verifier
    let verifier_id = env.register(mock_verifier_fail::MockVerifierFail, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &merkle_root, &payout, &token_id, &verifier_id);
    client.set_paused(&false);
    client.fund(&admin, &100_000_000i128);

    let inputs = ProofPublicInputs {
        claimant_address_field: make_id(&env, 10),
        disbursement_id: campaign_id,
        expires_at: valid_expires_at(),
        issuer_key_id: issuer_key(&env),
        merkle_root,
        nullifier: make_id(&env, 3),
    };

    // Any proof should be rejected by the failing verifier
    client.claim(&claimant, &inputs, &make_real_proof(&env));
}

#[test]
#[should_panic(expected = "Merkle root mismatch")]
fn test_wrong_merkle_root_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let real_root = make_id(&env, 2);
    let fake_root = make_id(&env, 99);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &real_root, &payout, &token_id, &verifier_id);
    client.set_paused(&false);
    client.fund(&admin, &100_000_000i128);

    let inputs = ProofPublicInputs {
        claimant_address_field: addr_to_field(&env, &claimant),
        disbursement_id: campaign_id,
        expires_at: valid_expires_at(),
        issuer_key_id: issuer_key(&env),
        merkle_root: fake_root, // tampered root — triggers "Merkle root mismatch"
        nullifier: make_id(&env, 3),
    };

    client.claim(&claimant, &inputs, &make_real_proof(&env));
}

#[test]
#[should_panic(expected = "Claimant address does not match proof")]
fn test_address_mismatch_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let other = Address::generate(&env); // proof was for "other", not "claimant"
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);

    client.initialize(&admin, &campaign_id, &merkle_root, &10_000_000i128, &token_id, &verifier_id);
    client.set_paused(&false);
    client.fund(&admin, &100_000_000i128);

    let inputs = ProofPublicInputs {
        claimant_address_field: addr_to_field(&env, &other), // mismatch: proof is for "other"
        disbursement_id: campaign_id,
        expires_at: valid_expires_at(),
        issuer_key_id: issuer_key(&env),
        merkle_root,
        nullifier: make_id(&env, 3),
    };

    client.claim(&claimant, &inputs, &make_real_proof(&env));
}

#[test]
#[should_panic(expected = "Credential issuer is not active")]
fn test_inactive_issuer_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    client.initialize(&admin, &campaign_id, &merkle_root, &10_000_000i128, &token_id, &verifier_id);
    client.set_paused(&false);
    client.fund(&admin, &100_000_000i128);

    let inputs = make_inputs(&env, &claimant, campaign_id, merkle_root, make_id(&env, 3));
    client.claim(&claimant, &inputs, &make_real_proof(&env));
}

#[test]
#[should_panic(expected = "Credential issuer is not active")]
fn test_revoked_issuer_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    client.initialize(&admin, &campaign_id, &merkle_root, &10_000_000i128, &token_id, &verifier_id);
    client.add_issuer(&issuer_key(&env));
    client.revoke_issuer(&issuer_key(&env));
    client.set_paused(&false);
    client.fund(&admin, &100_000_000i128);

    let inputs = make_inputs(&env, &claimant, campaign_id, merkle_root, make_id(&env, 3));
    client.claim(&claimant, &inputs, &make_real_proof(&env));
}

#[test]
#[should_panic(expected = "Credential expired")]
fn test_expired_credential_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(2_000_000_001);

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let sac = soroban_sdk::token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&admin, &1_000_000_000i128);

    let verifier_id = env.register(mock_verifier_ok::MockVerifierOk, ());
    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    client.initialize(&admin, &campaign_id, &merkle_root, &10_000_000i128, &token_id, &verifier_id);
    client.add_issuer(&issuer_key(&env));
    client.set_paused(&false);
    client.fund(&admin, &100_000_000i128);

    let inputs = make_inputs(&env, &claimant, campaign_id, merkle_root, make_id(&env, 3));
    client.claim(&claimant, &inputs, &make_real_proof(&env));
}
