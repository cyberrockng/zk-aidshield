# ZK AidShield Judging Notes

## Why This Can Win

ZK AidShield is a complete privacy-preserving aid disbursement workflow, not only a proof-of-concept circuit. The strongest thesis is:

> Private aid eligibility. Public settlement accountability.

The project uses ZK where it matters: a beneficiary cannot unlock settlement unless a Groth16 proof verifies eligibility and nullifier correctness. Stellar is not decorative; Soroban verifies the proof path, enforces issuer/vendor/replay controls, and settles XLM from escrow.

The demo shows:

- operator credential issuance
- wallet-bound eligibility proof
- browser-side Groth16 proof generation
- on-chain BLS12-381 verification on Soroban
- replay protection with persistent nullifiers
- encrypted mobile QR credential export/import for field delivery
- approved-vendor voucher redemption for restricted aid budgets
- admin-protected local non-PII issuance ledger for operator accountability
- local beneficiary claim receipts after payout
- live threat-resistance dashboard showing issuer, vendor, replay, escrow, pause, and governance posture
- competitive edge board showing proof outcomes, selective disclosure, telemetry, no-wallet judge path, attack simulator, and readiness growth
- synthetic crisis mission page showing NGO operator, beneficiary, approved vendor, replay failure, and donor audit view without claiming real-world deployment
- protocol-fit page showing off-chain proof generation, on-chain Soroban verification, and XLM settlement alignment with the hackathon brief
- no-wallet judge mode that explains the proof payload before Freighter is required
- field-pilot readiness page showing operational workflows and honest production gaps
- real XLM escrow payout through the Stellar Asset Contract
- auditor-facing stats and trust model

## What Judges Should Notice

| Criterion | Evidence |
| --- | --- |
| Real-world relevance | Humanitarian aid systems expose sensitive beneficiary data; AidShield removes PII from settlement |
| ZK depth | Circom circuit proves Merkle membership and nullifier correctness while hiding the secret |
| Stellar fit | Low-cost, fast settlement with native SAC payout and Soroban BLS12-381 host functions |
| Security thinking | Wallet-bound leaves, on-chain replay blocking, issuer/vendor controls, pause switch, trust model, threat dashboard, and incident playbook |
| Demo completeness | Mission, Evidence, Admin, encrypted QR delivery, approved-vendor vouchers, local non-PII issuance ledger, claim receipt, stats, audit, threats, edge board, deployed testnet contracts, and automated tests |
| Expansion path | Issuer governance, optional identity adapters, multi-vendor operations, and public trusted setup |

## Strongest Demo Path

1. Open `/mission` and state that the flood-relief campaign uses synthetic testnet actors, while the ZK proof and Stellar mechanics are real.
2. Open `/evidence` and show the requirement match, contract anchors, red-team matrix, and honest synthetic/testnet boundary.
3. Open `/protocol` and show that AidShield follows the hackathon pattern: off-chain proof, on-chain Stellar verification, and real settlement.
4. Show the admin page, approve/check a vendor, and issue a credential to a specific Freighter wallet.
5. Show the encrypted credential QR and non-PII issuance ledger, then switch to the claim page and decrypt/load the credential.
6. Choose direct cash or vendor voucher mode and generate the Groth16 proof in-browser.
7. Approve the transaction in Freighter.
8. Show the Stellar Explorer transaction, strengthened claim receipt, and auditor dashboard update.
9. Open `/threats` and show that the product blocks or monitors forged proofs, replay, revoked issuers, unauthorized vendors, underfunded escrow, and governance risk.
10. Open `/edge` and show the proof board, selective disclosure table, proof telemetry, no-wallet judge path, attack simulator, and competitive readiness growth.
11. Try the same credential again to show replay protection.
12. Switch wallets and show credential binding rejection.
13. Open `/pilot`, `/audit`, and `/judges` to explain trust boundaries and production roadmap.

## Winning Angle

Most ZK demos prove a primitive. AidShield proves a field-ready aid workflow: privacy for recipients, fraud resistance for operators, threat-aware controls for field operations, and public accountability for donors.

The key distinction is that AidShield does not ask judges to imagine the final product. It already demonstrates the full loop: issue a wallet-bound QR credential, generate a private proof in the browser, verify on Soroban, settle XLM, reject replay, and audit aggregate outcomes without exposing beneficiary PII.

## Next Build After Hackathon

1. Human Passport or Self/OpenPassport optional intake adapter.
2. Browser-guided multi-governor signing UX for threshold-2 operations.
3. Multi-vendor reporting and per-vendor redemption limits.
4. Public multi-party trusted setup.
