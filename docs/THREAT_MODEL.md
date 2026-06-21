# ZK AidShield Threat Model

Research date: 2026-06-19

## Security Goal

AidShield protects beneficiary privacy while preserving disbursement accountability:

- eligible beneficiaries can claim once
- ineligible wallets cannot claim
- duplicate claims are rejected on-chain
- names, IDs, and beneficiary lists are never published on-chain
- auditors can verify campaign funding and claim counts

## Assets Protected

| Asset | Protection |
| --- | --- |
| Beneficiary identity | Never included in on-chain state or events |
| Claim secret | Private circuit input; used only inside local proof generation |
| Eligibility list | Committed as a Merkle root, not published |
| Payout funds | Held in Soroban escrow and released only after proof verification |
| Replay protection | Nullifier is persisted on-chain after first claim |
| Campaign integrity | Disbursement ID, Merkle root, payout amount, and verifier address are contract state |

## Trust Boundaries

| Boundary | Current guarantee | Production hardening |
| --- | --- | --- |
| Aid operator eligibility vetting | Off-chain trust | Multi-issuer governance and audit trails |
| Credential issuance API | Server signs credentials and keeps campaign secrets server-side | HSM/secret manager, rate limits, durable issuance ledger |
| Beneficiary device | Secret stays in browser during proof generation | Mobile wallet support, encrypted backup, recovery flow |
| Stellar contract | Verifies proof, root, nullifier, signer, payout | On-chain issuer registry and expiry checks |
| ZK setup | Demo proving key | Public multi-party ceremony or setup-minimized proof system |

## Attacks Covered Today

| Attack | Status | Defense |
| --- | --- | --- |
| Double claim | Blocked on-chain | `UsedNullifier(nullifier)` persistent storage |
| Forged membership | Blocked cryptographically | Groth16 proof verified by BLS12-381 pairing check |
| Wrong campaign/root | Blocked on-chain | Public inputs must match stored disbursement ID and Merkle root |
| Claim with stolen proof from another wallet | Blocked on-chain | Proof public input must match transaction signer |
| Claim with stolen credential from another wallet | Blocked by circuit design | Leaf and nullifier include `claimant_address` |
| PII leakage through chain | Avoided by design | Only root, nullifier, amount, and contract events are public |

## Known Residual Risks

| Risk | Why it matters | Planned mitigation |
| --- | --- | --- |
| Issuer operational compromise | Compromise lets an attacker issue credentials for pre-committed campaign slots while the key remains active | Revoke issuer on-chain; add threshold admin and per-issuer limits |
| Operator knows wallet-to-person mapping | The chain is private, but the operator can still identify recipients | Separate enrollment from payout operations; minimize retained PII |
| Lost credential | A beneficiary can lose access before claiming | Encrypted backup and controlled reissue workflow |
| Coercion or forced claims | A hostile actor may pressure a beneficiary to claim in front of them | Mobile privacy UX, delayed claim windows, approved-vendor voucher mode, field-officer training |
| 256-slot demo tree | Current depth is hackathon-sized | Configurable tree depth and campaign epochs |
| Single-contributor trusted setup | Demo setup is not production-grade | Public ceremony before mainnet deployment |

## Production Readiness Bar

Before real humanitarian deployment, AidShield should add:

1. Browser-guided multi-governor signing UX for threshold-2 operations.
2. Per-issuer issuance limits.
3. Encrypted credential backup and recovery.
4. Category-scoped vendor voucher limits.
5. Public multi-party trusted setup.
6. Larger configurable Merkle trees.
7. Independent circuit and contract audit.
8. Public trusted setup ceremony.
