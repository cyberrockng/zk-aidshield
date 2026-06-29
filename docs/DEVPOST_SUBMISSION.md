# ZK AidShield DoraHacks Submission

## Tagline

Privacy-preserving humanitarian aid payouts on Stellar: prove eligibility, claim once, keep aid-list membership private.

## Inspiration

Humanitarian aid systems often require beneficiaries to expose names, IDs, and claim records to receive help. In conflict or displacement settings, that data trail can become dangerous. ZK AidShield uses zero-knowledge proofs so recipients can prove eligibility without publishing names, IDs, private credentials, or aid-list membership.

## What It Does

ZK AidShield turns Stellar into a privacy-preserving crisis-aid settlement rail. A donor funds campaign escrow, an aid operator commits an approved beneficiary set as a Poseidon Merkle root, and a beneficiary receives a signed credential. The beneficiary generates a Groth16 BLS12-381 proof locally in the browser and submits it to Soroban. The contract verifies the proof, checks issuer status and expiry, blocks replay with a nullifier, then releases XLM from escrow.

Operators can deliver credentials as JSON files, copied payloads, or passphrase-protected QR codes for phone-first field use. QR import decrypts locally, then preserves the same signature, wallet-binding, expiry, and nullifier checks.

AidShield now supports restricted voucher redemption: admins approve vendors on-chain, beneficiaries choose voucher mode, and the same private eligibility proof pays the approved vendor instead of the claimant wallet. The same nullifier prevents a credential from being used for both cash and voucher redemption.

For operator accountability, the admin dashboard keeps an admin-protected non-PII issuance ledger with keyed wallet identifiers, credential hashes, issuer key IDs, expiry windows, and delivery modes. Production issuance uniqueness is backed by Upstash Redis reservations with fail-closed enforcement. Donors can export proof-of-impact funding receipts, and beneficiaries can export private claim receipts with transaction hash, nullifier, campaign ID, and amount.

## Crisis Aid Mission Demo

The submission includes a clearly labeled synthetic testnet mission at `/mission`: a flood-relief NGO operator issues an encrypted QR credential, an approved household claims privately, an approved medical vendor can receive voucher payment, replay fails, and donors inspect aggregate settlement without seeing beneficiary PII.

This scenario uses simulated actors and demo labels only. It does not claim a real NGO deployment or real-world aid distribution. The underlying mechanics are real: deployed Stellar testnet contracts, Groth16 proof verification, escrow accounting, vendor controls, encrypted QR credentials, and nullifier replay protection.

The `/evidence` page is the judge-facing proof dossier: it maps each hackathon requirement to concrete evidence, links the deployed contract anchors, summarizes verifiable privacy and replay claims, and gives a red-team demo matrix for failure paths.

The `/judge-console` page ties the live review flow together: donor escrow funding, admin credential issuance, private claim, public receipt, and credential reuse rejection. The broader `/command-center` remains available for deeper review of campaign prep, claim pass generation, proof receipts, impact metrics, and auditor views. The `/protocol` page maps AidShield directly to the Stellar Hacks brief: off-chain Circom proof generation, on-chain Soroban verification, Stellar XLM settlement, load-bearing ZK, and public auditability.

## Current Submission Scope

- Judge Demo Console at `/judge-console`
- AidShield Command Center at `/command-center` for deeper operational review
- donor escrow portal and proof-of-impact receipts at `/donor`
- NGO campaign builder at `/campaign-builder`
- beneficiary claim-pass formatter at `/claim-pass`
- proof receipt inspector at `/receipt`
- privacy impact dashboard at `/impact`
- Upstash Redis durable issuance reservations with fail-closed production mode
- public external review issue and trusted setup plan

- 6-public-input Groth16 circuit
- wallet-, expiry-, and issuer-bound Merkle leaves
- on-chain issuer registry with revocation
- on-chain credential expiry enforcement by ledger timestamp
- encrypted mobile QR credential export/import
- approved-vendor voucher redemption
- live threat-resistance dashboard for policy, issuer, vendor, replay, escrow, and governance posture
- competitive edge board with judge proof outcomes, selective disclosure, proof telemetry, no-wallet demo guidance, attack simulator, and readiness growth table
- synthetic crisis mission page showing NGO, beneficiary, vendor, replay, and donor-audit flow without false real-world claims
- evidence dossier page mapping requirements, contract anchors, threat tests, and video beats to judge-verifiable proof
- protocol-fit page mapping the project to Real-World ZK on Stellar
- no-wallet judge mode before the live Freighter path
- field-pilot readiness page with honest production gaps
- incident playbook for compromised issuers, vendors, credential leaks, and replay attempts
- admin-protected local non-PII issuance ledger
- local beneficiary claim receipts
- admin-protected credential issuance and beneficiary-slot APIs
- fresh Stellar testnet deployment with 50 XLM escrow

## Built With

- Stellar Soroban
- Rust smart contracts
- circom 2.1
- snarkjs Groth16
- BLS12-381 pairing verification
- Poseidon Merkle tree
- Next.js, TypeScript, Tailwind
- Freighter wallet

## Deployed Contracts

- Disbursement: `CDCT4TCFKSIBOCFV6OATUJB2Y3GOF72KIG7NLOAK7Z4HMGYF4PE3V5NC`
- Verifier: `CAVU2HNFWXALJG2FNFWZA4Y3WBV7VL5W7LBP4WYMZQFG26XHQNLTSAHQ`
- Merkle root: `5a5f381aacee4115a0f033e640b9dbd973f109accdf1affb8daab6e2ae2ae01b`
- VK hash: `c243d169dcf36311eb4d12d5f0fe3016f8d6da21e7e41ca88474c0b477d4d128`

## Demo Flow

1. Open `/judge-console` to show the complete review path and public anchors.
2. Open `/donor` to show public campaign funding and donor proof-of-impact receipts.
3. Open `/admin`, enter the demo admin secret, and issue a wallet-bound beneficiary credential.
4. Show the non-PII issuance ledger, then open `/claim`, load the credential, and generate the browser Groth16 proof.
5. Approve in Freighter and show the Stellar Explorer transaction.
6. Download/copy the local claim receipt and inspect it at `/receipt`.
7. Retry the same credential to show replay protection.
8. Use `/protocol`, `/evidence`, `/impact`, and `/audit` if the reviewer asks for deeper proof, privacy boundaries, or production gaps.

## Security Posture

AidShield keeps names, IDs and beneficiary-list membership off-chain. The issuer API delivers the credential secret and Merkle witness inside a signed credential for local browser proving; during claim, those witness values are not sent on-chain or to the verifier. Operator APIs are protected by an admin secret, local ledger wallet identifiers use keyed HMACs instead of raw addresses, and the threat dashboard makes the issuer, vendor, replay, escrow, pause, and governance posture visible.

The Stellar payout itself remains public settlement data: observers can see payout wallet, timing, amount, contract IDs, Merkle root, verifier key hash, and nullifier. That is the accountability layer, not a claim that the final token transfer is anonymous.

## Why It Matters

Most ZK demos prove a primitive. ZK AidShield proves a real aid workflow: private eligibility, fraud-resistant claims, public payout accountability, and Stellar-native settlement.

## Challenges

The hardest part was aligning the same BLS12-381 Poseidon statement across circom, browser proving, TypeScript Merkle generation, and Soroban verification. The current build keeps that statement stable while adding AidShield Command Center, donor escrow receipts, durable issuance reservations, proof receipts, impact dashboards, approved-vendor voucher redemption, threshold governor controls, and a threat-resistance dashboard without weakening replay protection or wallet binding.

## What Is Next

- Human Passport or Self/OpenPassport optional enrollment adapter
- per-issuer operational limits and alerting
- public multi-party trusted setup before production use
