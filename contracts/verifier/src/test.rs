#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};

use super::*;

fn create_verifier(env: &Env) -> (Address, AidShieldVerifierClient) {
    let contract_id = env.register_contract(None, AidShieldVerifier);
    let client = AidShieldVerifierClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(&admin);
    (contract_id, client)
}

fn make_real_proof(env: &Env) -> Bytes {
    // Build a 14 656-byte proof with non-zero bytes in the commitment region (32..96)
    let mut data = [0u8; 14_656];
    // Simulate a non-trivial commitment region
    for i in 32..96 {
        data[i] = (i as u8).wrapping_add(1);
    }
    Bytes::from_slice(env, &data)
}

fn make_public_inputs(env: &Env) -> Bytes {
    let data = [1u8; 128];
    Bytes::from_slice(env, &data)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client) = create_verifier(&env);
    // VK hash should match the hard-coded constant
    let vk = client.vk_hash();
    assert_eq!(vk, BytesN::from_array(&env, &VK_HASH));
}

#[test]
fn test_verify_valid() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client) = create_verifier(&env);
    let proof = make_real_proof(&env);
    let pi = make_public_inputs(&env);
    assert!(client.verify(&proof, &pi));
}

#[test]
fn test_verify_wrong_proof_length() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client) = create_verifier(&env);
    let short_proof = Bytes::from_slice(&env, &[0u8; 64]);
    let pi = make_public_inputs(&env);
    assert!(!client.verify(&short_proof, &pi));
}

#[test]
fn test_verify_wrong_pi_length() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client) = create_verifier(&env);
    let proof = make_real_proof(&env);
    let short_pi = Bytes::from_slice(&env, &[0u8; 32]);
    assert!(!client.verify(&proof, &short_pi));
}

#[test]
fn test_verify_zero_proof_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (_, client) = create_verifier(&env);
    let zero_proof = Bytes::from_slice(&env, &[0u8; 14_656]);
    let pi = make_public_inputs(&env);
    assert!(!client.verify(&zero_proof, &pi));
}
