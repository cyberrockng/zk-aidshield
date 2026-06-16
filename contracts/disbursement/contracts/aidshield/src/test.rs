#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN, Env};

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

fn make_real_proof(env: &Env) -> Bytes {
    // 14 656-byte proof with non-zero bytes in commitment region (32..96)
    let mut data = [0u8; 14_656];
    for i in 32..96 {
        data[i] = (i as u8).wrapping_add(1);
    }
    Bytes::from_slice(env, &data)
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
        claimant_address_field: make_id(&env, 10),
        disbursement_id: campaign_id.clone(),
        merkle_root: merkle_root.clone(),
        nullifier: nullifier.clone(),
    };

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

    let inputs = ProofPublicInputs {
        claimant_address_field: make_id(&env, 10),
        disbursement_id: campaign_id,
        merkle_root,
        nullifier,
    };

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
        claimant_address_field: make_id(&env, 10),
        disbursement_id: campaign_id,
        merkle_root: fake_root, // tampered root
        nullifier: make_id(&env, 3),
    };

    client.claim(&claimant, &inputs, &make_real_proof(&env));
}
