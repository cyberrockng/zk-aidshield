# Trusted Setup Plan

ZK AidShield currently uses a hackathon/demo Groth16 setup. The verifier key hash is published so judges can compare the deployed verifier against the circuit artifact, but this is not a substitute for a production ceremony.

## Production Ceremony Goal

Create a publicly reproducible proving/verifier key pair for the AidShield circuit where no single contributor can know the final toxic waste.

## Ceremony Inputs

- Circuit source: `circuits/aidshield-groth16`
- Constraint build artifacts
- Hash of the circuit source tree
- Ceremony coordinator instructions
- Contributor identity or pseudonym list
- Transcript verification script

## Ceremony Steps

1. Freeze the circuit source and tag a release.
2. Publish the circuit hash and build instructions.
3. Generate the initial Powers of Tau / phase artifacts using standard tooling.
4. Invite multiple independent contributors to add entropy.
5. For each contribution:
   - verify the previous transcript,
   - add entropy locally,
   - publish the contribution hash,
   - delete local secret randomness.
6. Verify the final transcript from the full contribution chain.
7. Generate the final proving key and verifier key.
8. Publish:
   - final verifier key,
   - verifier key hash,
   - transcript hashes,
   - contributor list,
   - exact build commands.
9. Deploy a fresh Stellar verifier contract initialized with the final verifier key.
10. Update the disbursement contract to point at the new verifier.

## Acceptance Criteria

- Anyone can rebuild the circuit and reproduce the verifier key hash.
- Anyone can verify every ceremony contribution transcript.
- At least three independent contributors participate.
- Final verifier key hash is shown in the app, README, and DoraHacks submission notes.
- Old demo verifier is clearly labeled as deprecated.

## Current Hackathon Position

For this submission, the setup is honestly labeled demo-grade. The ZK path is still real: the browser generates a Groth16 proof and Soroban verifies it on-chain. The ceremony plan is the production upgrade path before mainnet use.
