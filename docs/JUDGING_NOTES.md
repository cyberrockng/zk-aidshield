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
- real XLM escrow payout through the Stellar Asset Contract
- auditor-facing stats and trust model

## What Judges Should Notice

| Criterion | Evidence |
| --- | --- |
| Real-world relevance | Humanitarian aid systems expose sensitive beneficiary data; AidShield removes PII from settlement |
| ZK depth | Circom circuit proves Merkle membership and nullifier correctness while hiding the secret |
| Stellar fit | Low-cost, fast settlement with native SAC payout and Soroban BLS12-381 host functions |
| Security thinking | Wallet-bound leaves, on-chain replay blocking, pause switch, trust model, and threat model |
| Demo completeness | Admin, encrypted QR delivery, approved-vendor vouchers, non-PII issuance ledger, claim receipt, stats, audit, deployed testnet contracts, and automated tests |
| Expansion path | Issuer governance, optional identity adapters, multi-vendor operations, and public trusted setup |

## Strongest Demo Path

1. Show the admin page, approve/check a vendor, and issue a credential to a specific Freighter wallet.
2. Show the encrypted credential QR and non-PII issuance ledger, then switch to the claim page and decrypt/load the credential.
3. Choose direct cash or vendor voucher mode and generate the Groth16 proof in-browser.
4. Approve the transaction in Freighter.
5. Show the Stellar Explorer transaction, claim receipt, and auditor dashboard update.
6. Try the same credential again to show replay protection.
7. Switch wallets and show credential binding rejection.
8. Open the audit/judge page to explain trust boundaries and production roadmap.

## Winning Angle

Most ZK demos prove a primitive. AidShield proves a field-ready aid workflow: privacy for recipients, fraud resistance for operators, and public accountability for donors.

## Next Build After Hackathon

1. Human Passport or Self/OpenPassport optional intake adapter.
2. Threshold-admin issuer governance.
3. Multi-vendor reporting and per-vendor redemption limits.
4. Public multi-party trusted setup.
