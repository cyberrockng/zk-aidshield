#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Env, Address, BytesN};

fn make_id(env: &Env, val: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[31] = val;
    BytesN::from_array(env, &bytes)
}

fn make_proof(env: &Env) -> BytesN<64> {
    BytesN::from_array(env, &[0u8; 64])
}

#[test]
fn test_initialize_and_stats() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let payout = 10_000_000i128; // 1 XLM in stroops

    client.initialize(&admin, &campaign_id, &merkle_root, &payout);

    let s = client.stats();
    assert_eq!(s.escrow_balance, 0);
    assert_eq!(s.claimed_count, 0);
    assert_eq!(s.payout_amount, payout);
    assert_eq!(s.merkle_root, merkle_root);
}

#[test]
fn test_fund_and_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let nullifier = make_id(&env, 3);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &merkle_root, &payout);
    client.fund(&admin, &(payout * 10));

    let stats_before = client.stats();
    assert_eq!(stats_before.escrow_balance, payout * 10);

    let inputs = ProofPublicInputs {
        disbursement_id: campaign_id.clone(),
        merkle_root: merkle_root.clone(),
        nullifier: nullifier.clone(),
        claimant_address: claimant.clone(),
    };

    client.claim(&claimant, &inputs, &make_proof(&env));

    let stats_after = client.stats();
    assert_eq!(stats_after.claimed_count, 1);
    assert_eq!(stats_after.escrow_balance, payout * 9);
    assert!(client.is_nullifier_used(&nullifier));
}

#[test]
#[should_panic(expected = "Nullifier already used")]
fn test_replay_attack_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let nullifier = make_id(&env, 3);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &merkle_root, &payout);
    client.fund(&admin, &(payout * 10));

    let inputs = ProofPublicInputs {
        disbursement_id: campaign_id.clone(),
        merkle_root: merkle_root.clone(),
        nullifier: nullifier.clone(),
        claimant_address: claimant.clone(),
    };

    // First claim succeeds
    client.claim(&claimant, &inputs.clone(), &make_proof(&env));
    // Second claim with same nullifier must panic
    client.claim(&claimant, &inputs, &make_proof(&env));
}

#[test]
#[should_panic(expected = "Address mismatch")]
fn test_address_binding_enforced() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let attacker = Address::generate(&env);
    let campaign_id = make_id(&env, 1);
    let merkle_root = make_id(&env, 2);
    let nullifier = make_id(&env, 3);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &merkle_root, &payout);
    client.fund(&admin, &(payout * 10));

    // Proof was generated for `claimant` but attacker tries to use it
    let inputs = ProofPublicInputs {
        disbursement_id: campaign_id,
        merkle_root,
        nullifier,
        claimant_address: claimant, // proof bound to claimant
    };

    client.claim(&attacker, &inputs, &make_proof(&env)); // attacker submits — must panic
}

#[test]
#[should_panic(expected = "Merkle root mismatch")]
fn test_wrong_merkle_root_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AidShieldContract, ());
    let client = AidShieldContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let claimant = Address::generate(&env);
    let campaign_id = make_id(&env, 1);
    let real_root = make_id(&env, 2);
    let fake_root = make_id(&env, 99);
    let nullifier = make_id(&env, 3);
    let payout = 10_000_000i128;

    client.initialize(&admin, &campaign_id, &real_root, &payout);
    client.fund(&admin, &(payout * 10));

    let inputs = ProofPublicInputs {
        disbursement_id: campaign_id,
        merkle_root: fake_root, // tampered root
        nullifier,
        claimant_address: claimant.clone(),
    };

    client.claim(&claimant, &inputs, &make_proof(&env));
}
