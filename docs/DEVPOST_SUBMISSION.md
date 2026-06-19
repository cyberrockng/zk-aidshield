# ZK AidShield Devpost Submission

## Tagline

Privacy-preserving humanitarian aid payouts on Stellar: prove eligibility, claim once, reveal no identity.

## Inspiration

Humanitarian aid systems often require beneficiaries to expose names, IDs, and claim records to receive help. In conflict or displacement settings, that data trail can become dangerous. ZK AidShield uses zero-knowledge proofs so recipients can prove eligibility without publishing who they are.

## What It Does

ZK AidShield lets an aid operator commit an approved beneficiary set as a Poseidon Merkle root. A beneficiary receives a signed credential, generates a Groth16 BLS12-381 proof locally in the browser, and submits it to Soroban. The contract verifies the proof, checks issuer status and expiry, blocks replay with a nullifier, then releases XLM from escrow.

## What Is New In Phase 4

- 6-public-input Groth16 circuit
- wallet-, expiry-, and issuer-bound Merkle leaves
- on-chain issuer registry with revocation
- on-chain credential expiry enforcement by ledger timestamp
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

- Disbursement: `CDKODSLWLQ6FSRMDEFWLOMCTQOKJ6PTNAJE3RNJYL7NJFQ3JDRBLAHFO`
- Verifier: `CAUJSUQBLM4E4N2CW26M2FJ2CM2LV4BE44PS76V7AYIN77DVDA7ZPYP4`
- Merkle root: `6631aeabd22a5cbca2274005d52490c4ee556c4eb7d97927e3eb9b724a26c2a7`
- VK hash: `ae6fe01643bcc5965d24d9a3d95ea22210ee13293e134f9a50de3134e6f0be3c`

## Demo Flow

1. Open `/judges` to show the short technical brief.
2. Open `/stats` to show live 50 XLM escrow and deployed contracts.
3. Open `/admin` and issue a beneficiary credential.
4. Open `/claim`, load the credential, and generate the browser Groth16 proof.
5. Approve in Freighter and show the Stellar Explorer transaction.
6. Retry the same credential to show replay protection.
7. Switch wallets to show wrong-wallet rejection.
8. Open `/audit` to show trust boundaries and known limitations.

## Why It Matters

Most ZK demos prove a primitive. ZK AidShield proves a real aid workflow: private eligibility, fraud-resistant claims, public payout accountability, and Stellar-native settlement.

## Challenges

The hardest part was aligning the same BLS12-381 Poseidon statement across circom, browser proving, TypeScript Merkle generation, and Soroban verification. Phase 4 also required changing the proof statement without weakening replay protection or wallet binding.

## What Is Next

- mobile QR credential import
- vendor/voucher mode
- threshold-admin issuer governance
- Human Passport or Self/OpenPassport optional enrollment adapter
- public multi-party trusted setup before production use
