# Independent Audit Scope

This file defines the external review request for ZK AidShield before any production pilot.

## Assets In Scope

- Circom circuit and Groth16 public input design.
- Soroban disbursement contract: claim, voucher claim, issuer registry, vendor registry, pause, root update, governance threshold, nullifier storage.
- Groth16 BLS12-381 verifier contract and verification key initialization.
- Credential issuance API, admin authentication, rate limits, Redis issuance reservations, and non-PII ledger.
- Browser witness handling, encrypted QR flow, receipt generation, and transaction verification.
- Deployment scripts and environment variable handling.

## Required Findings

The reviewer should classify issues as critical, high, medium, low, or informational and answer:

- Can a claimant receive funds without a valid witness?
- Can a valid claimant claim twice?
- Can a stolen credential be used by another wallet?
- Can a revoked issuer or unapproved vendor still receive settlement?
- Can frontend or API behavior leak credential secrets, Merkle paths, or issuer secrets?
- Are admin actions protected against accidental or malicious misuse?

## Evidence To Provide

- Commit hash reviewed.
- Circuit artifact hashes.
- Deployed contract IDs.
- Test commands and results.
- Any manual reproduction steps.
- Recommended production blockers.

## Current Status

The repo is ready to request review. A real external review is still an external action and should not be represented as completed until an independent reviewer publishes results.
