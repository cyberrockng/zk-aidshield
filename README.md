# ZK AidShield — Claim Cash, Not Your Identity

> Privacy-preserving aid disbursement on Stellar. Prove you're eligible. Reveal nothing.

## What It Does

ZK AidShield adds a zero-knowledge claim layer to aid disbursement on Stellar. A beneficiary proves they are on an approved aid list and have not claimed before — **without revealing their name, phone number, ID, or the full beneficiary roster on-chain**.

Soroban verifies the proof using Stellar's BN254 and Poseidon2 host functions (Protocol 25/26) and releases the payout instantly.

- **NGOs** get fraud resistance (replay attacks cryptographically blocked)
- **Recipients** get dignity and safety (zero PII on-chain)
- **Auditors** get verifiable proof counts without seeing who claimed

## How It Works

```
Admin uploads beneficiary list
        ↓
Poseidon2 Merkle root committed on Soroban
        ↓
Recipient receives private claim secret (off-chain)
        ↓
Noir circuit generates membership + nullifier proof locally
        ↓
Soroban verifier checks proof using BN254 host functions
        ↓
Nullifier unused? → Payout released
Nullifier used?   → Replay rejected
```

## What's On-Chain

| Data | On-chain? |
|---|---|
| Beneficiary name | ❌ Never |
| Phone number | ❌ Never |
| National ID | ❌ Never |
| Beneficiary list | ❌ Never |
| Merkle root (commitment) | ✅ Yes |
| Nullifier hash | ✅ Yes (after claim) |
| Payout event | ✅ Yes |

## Tech Stack

| Layer | Technology |
|---|---|
| ZK Circuit | Noir + Barretenberg |
| Smart Contracts | Soroban (Rust) |
| Hashing | Poseidon2 / soroban-poseidon |
| Frontend | Next.js + TypeScript + Tailwind |
| Wallet | Freighter (Stellar) |
| Token Payout | SAC test token (Stellar testnet) |

## Project Structure

```
zk-aidshield/
├─ apps/web/               # Next.js claim UI + admin dashboard
├─ contracts/
│  ├─ disbursement/        # Soroban payout + nullifier registry
│  └─ verifier/            # Noir proof verifier adapter
├─ circuits/
│  └─ aidshield-membership/ # Noir circuit + tests
├─ packages/
│  ├─ merkle-tools/        # Leaf generation, root builder, witness export
│  └─ shared/              # Shared TS types and campaign schema
├─ scripts/                # Deploy, seed, and demo data scripts
└─ docs/                   # Architecture, threat model, demo script
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Generate demo campaign data
pnpm run seed

# Deploy contracts to Stellar testnet
pnpm run deploy:testnet

# Run the web app
pnpm run dev
```

## Submission

Built for **Stellar Hacks: Real-World ZK** — DoraHacks, June 2026.

> This is a testnet research prototype for hackathon evaluation only.
