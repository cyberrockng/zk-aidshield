# ZK AidShield Devpost Submission

## Tagline

Privacy-preserving humanitarian aid payouts on Stellar: prove eligibility, claim once, keep aid-list membership private.

## Inspiration

Humanitarian aid systems often require beneficiaries to expose names, IDs, and claim records to receive help. In conflict or displacement settings, that data trail can become dangerous. ZK AidShield uses zero-knowledge proofs so recipients can prove eligibility without publishing names, IDs, private credentials, or aid-list membership.

## What It Does

ZK AidShield lets an aid operator commit an approved beneficiary set as a Poseidon Merkle root. A beneficiary receives a signed credential, generates a Groth16 BLS12-381 proof locally in the browser, and submits it to Soroban. The contract verifies the proof, checks issuer status and expiry, blocks replay with a nullifier, then releases XLM from escrow.

Operators can deliver credentials as JSON files, copied payloads, or passphrase-protected QR codes for phone-first field use. QR import decrypts locally, then preserves the same signature, wallet-binding, expiry, and nullifier checks.

For operator accountability, the admin dashboard keeps an admin-protected non-PII issuance ledger with keyed wallet identifiers, credential hashes, issuer key IDs, expiry windows, and delivery modes. After payout, beneficiaries can export a private claim receipt with transaction hash, nullifier, campaign ID, and amount.

## What Is New In Phase 4

- 6-public-input Groth16 circuit
- wallet-, expiry-, and issuer-bound Merkle leaves
- on-chain issuer registry with revocation
- on-chain credential expiry enforcement by ledger timestamp
- encrypted mobile QR credential export/import
- admin-protected non-PII issuance ledger
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

- Disbursement: `CD3FMAN3VJ6W6AHCH7CS3GIV56OO7BKBH5H2DIXT2H4TDZOUSMSSSGRC`
- Verifier: `CAVU2HNFWXALJG2FNFWZA4Y3WBV7VL5W7LBP4WYMZQFG26XHQNLTSAHQ`
- Merkle root: `6631aeabd22a5cbca2274005d52490c4ee556c4eb7d97927e3eb9b724a26c2a7`
- VK hash: `c243d169dcf36311eb4d12d5f0fe3016f8d6da21e7e41ca88474c0b477d4d128`

## Demo Flow

1. Open `/judges` to show the short technical brief.
2. Open `/stats` to show live 50 XLM escrow and deployed contracts.
3. Open `/admin` and issue a beneficiary credential as JSON or encrypted QR.
4. Show the non-PII issuance ledger, then open `/claim`, decrypt/load the credential by file, QR image, or paste, and generate the browser Groth16 proof.
5. Approve in Freighter and show the Stellar Explorer transaction.
6. Download/copy the local claim receipt.
7. Retry the same credential to show replay protection.
8. Switch wallets to show wrong-wallet rejection.
9. Open `/audit` to show trust boundaries and known limitations.

## Security Posture

AidShield keeps names, IDs, beneficiary-list membership, credential secrets, Merkle witnesses, and issuance records off-chain. Operator APIs are protected by an admin secret, and ledger wallet identifiers use keyed HMACs instead of raw addresses.

The Stellar payout itself remains public settlement data: observers can see payout wallet, timing, amount, contract IDs, Merkle root, verifier key hash, and nullifier. That is the accountability layer, not a claim that the final token transfer is anonymous.

## Why It Matters

Most ZK demos prove a primitive. ZK AidShield proves a real aid workflow: private eligibility, fraud-resistant claims, public payout accountability, and Stellar-native settlement.

## Challenges

The hardest part was aligning the same BLS12-381 Poseidon statement across circom, browser proving, TypeScript Merkle generation, and Soroban verification. Phase 4 also required changing the proof statement without weakening replay protection or wallet binding.

## What Is Next

- vendor/voucher mode
- threshold-admin issuer governance
- Human Passport or Self/OpenPassport optional enrollment adapter
- public multi-party trusted setup before production use
