# Field Pilot Runbook

This runbook converts the testnet crisis-aid demo into a controlled real-world pilot plan.

## Actors

- NGO operator: creates campaign, approves field officers, funds escrow, monitors exceptions.
- Field officer: enrolls approved beneficiaries and delivers encrypted claim passes.
- Beneficiary: receives credential, proves eligibility locally, and claims once.
- Vendor: receives voucher-mode settlement only when approved.
- Auditor/donor: verifies public impact without seeing private beneficiary data.

## Pilot Controls

- Use synthetic rehearsal data before real enrollment.
- Use one campaign, one payout amount, and one defined beneficiary cohort.
- Rotate issuer keys before pilot start.
- Enable durable issuance with Redis `SET NX`.
- Require admin authentication and rate limits on issuance APIs.
- Keep `campaign.json`, issuer secret, QR passphrases, and beneficiary CSV files off public repos.
- Record every issuance and delivery event as HMAC-hashed non-PII ledger entries.

## Field Flow

1. NGO approves campaign terms and payout rules.
2. Operator generates campaign Merkle root from local beneficiary data.
3. Operator deploys or updates contracts with campaign root and issuer registry.
4. Field officer issues encrypted QR or JSON claim pass to the beneficiary.
5. Beneficiary claims using wallet-bound credential and Freighter.
6. Auditor reviews aggregate campaign stats, receipts, and nullifier counts.
7. Incident team reviews failed claims, replay attempts, and vendor exceptions.

## Stop Conditions

Pause the campaign if there is evidence of issuer compromise, QR theft at scale, frontend tampering, vendor collusion, admin credential compromise, or mismatch between expected and observed claim volume.
