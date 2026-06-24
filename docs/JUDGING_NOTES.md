# ZK AidShield Judging Notes

## Why This Can Win

ZK AidShield is a complete privacy-preserving aid disbursement workflow, not only a proof-of-concept circuit.

The demo shows:

- operator credential issuance
- wallet-bound eligibility proof
- browser-side Groth16 proof generation
- on-chain BLS12-381 verification on Soroban
- replay protection with persistent nullifiers
- encrypted mobile QR credential export/import for field delivery
- approved-vendor voucher redemption for restricted aid budgets
- durable non-PII issuance ledger for operator accountability
- local beneficiary claim receipts after payout
- live threat-resistance dashboard showing issuer, vendor, replay, escrow, pause, and governance posture
- competitive edge board showing proof outcomes, selective disclosure, telemetry, no-wallet judge path, attack simulator, and readiness growth
- synthetic crisis mission page showing NGO operator, beneficiary, approved vendor, replay failure, and donor audit view without claiming real-world deployment
- real XLM escrow payout through the Stellar Asset Contract
- auditor-facing stats and trust model

## What Judges Should Notice

| Criterion | Evidence |
| --- | --- |
| Real-world relevance | Humanitarian aid systems expose sensitive beneficiary data; AidShield removes PII from settlement |
| ZK depth | Circom circuit proves Merkle membership and nullifier correctness while hiding the secret |
| Stellar fit | Low-cost, fast settlement with native SAC payout and Soroban BLS12-381 host functions |
| Security thinking | Wallet-bound leaves, on-chain replay blocking, issuer/vendor controls, pause switch, trust model, threat dashboard, and incident playbook |
| Demo completeness | Mission, Admin, encrypted QR delivery, approved-vendor vouchers, non-PII issuance ledger, claim receipt, stats, audit, threats, edge board, deployed testnet contracts, and automated tests |
| Expansion path | Issuer governance, optional identity adapters, multi-vendor operations, and public trusted setup |

## Strongest Demo Path

1. Open `/mission` and state that the flood-relief campaign uses synthetic testnet actors, while the ZK proof and Stellar mechanics are real.
2. Show the admin page, approve/check a vendor, and issue a credential to a specific Freighter wallet.
3. Show the encrypted credential QR and non-PII issuance ledger, then switch to the claim page and decrypt/load the credential.
4. Choose direct cash or vendor voucher mode and generate the Groth16 proof in-browser.
5. Approve the transaction in Freighter.
6. Show the Stellar Explorer transaction, claim receipt, and auditor dashboard update.
7. Open `/threats` and show that the product blocks or monitors forged proofs, replay, revoked issuers, unauthorized vendors, underfunded escrow, and governance risk.
8. Open `/edge` and show the proof board, selective disclosure table, proof telemetry, no-wallet judge path, and competitive readiness growth.
9. Try the same credential again to show replay protection.
10. Switch wallets and show credential binding rejection.
11. Open the audit/judge page to explain trust boundaries and production roadmap.

## Winning Angle

Most ZK demos prove a primitive. AidShield proves a field-ready aid workflow: privacy for recipients, fraud resistance for operators, threat-aware controls for field operations, and public accountability for donors.

## Next Build After Hackathon

1. Human Passport or Self/OpenPassport optional intake adapter.
2. Browser-guided multi-governor signing UX for threshold-2 operations.
3. Multi-vendor reporting and per-vendor redemption limits.
4. Public multi-party trusted setup.
