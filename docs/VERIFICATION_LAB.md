# Verification Lab

The live `/verification-lab` route gives judges a direct path to inspect the proof story.

## What To Verify

- Proof system: Groth16 BLS12-381.
- Verifier mode: Soroban native pairing verification.
- Public inputs: campaign root, disbursement ID, nullifier, claimant address, expiry, issuer key ID.
- Verifier key hash: compare README/docs hash with deployed verifier metadata and circuit artifacts.
- Receipt transaction: paste receipt JSON into `/receipt` and check transaction status plus declared AidShield contract against Stellar testnet RPC.
- Replay resistance: submit the same credential again and confirm nullifier rejection.
- Local proof evidence: run `npm run verify:proof` from the repo root when a private local `packages/merkle-tools/campaign.json` exists. The command generates a Groth16 proof from the local fixture and verifies it against `circuits/aidshield-groth16/build/verification_key.json` without printing the private witness.

## Strong Demo Evidence

The best judge proof is:

1. One successful claim transaction.
2. One failed replay attempt.
3. One public receipt transaction-status check.
4. One auditor page showing aggregate state.
5. One privacy boundary explanation showing hidden vs public fields.

## Receipt Verification Scope

`/receipt` currently verifies transaction status on Stellar testnet and checks any declared receipt contract against the configured AidShield disbursement contract. It does not yet decode Soroban event metadata to prove amount or nullifier equality from the transaction itself.
