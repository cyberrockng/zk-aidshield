# Verification Lab

The live `/verification-lab` route gives judges a direct path to inspect the proof story.

## What To Verify

- Proof system: Groth16 BLS12-381.
- Verifier mode: Soroban native pairing verification.
- Public inputs: campaign root, disbursement ID, nullifier, claimant address, expiry, issuer key ID.
- Verifier key hash: compare README/docs hash with deployed verifier metadata and circuit artifacts.
- Receipt transaction: paste receipt JSON into `/receipt` and verify the transaction hash against Stellar testnet RPC.
- Replay resistance: submit the same credential again and confirm nullifier rejection.

## Strong Demo Evidence

The best judge proof is:

1. One successful claim transaction.
2. One failed replay attempt.
3. One public receipt verification.
4. One auditor page showing aggregate state.
5. One privacy boundary explanation showing hidden vs public fields.
