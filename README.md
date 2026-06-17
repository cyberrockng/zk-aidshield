# ZK AidShield — Claim Aid, Not Your Identity

> Privacy-preserving humanitarian disbursement on Stellar. Prove eligibility with zero knowledge. Reveal nothing.

**Stellar Hacks: Real-World ZK · DoraHacks · June 2026**

---

## The Problem

Humanitarian aid systems leak data. Names, ID numbers, and claim records end up in databases that get hacked, sold, or handed to hostile actors. In conflict zones, a paper trail can be lethal.

ZK AidShield removes that paper trail entirely — using real zero-knowledge cryptography, not just encryption.

## What It Does

A beneficiary proves two things — they are on an approved list, and they haven't claimed before — **without revealing who they are**. No name, address, or ID ever touches the blockchain.

- **Aid operators** get cryptographic fraud resistance: replay attacks are impossible by construction
- **Beneficiaries** get dignity and safety: zero PII on-chain, ever
- **Auditors** get verifiable claim counts without seeing who claimed or when

## Live Demo Flow (for Judges)

1. Go to `/admin` → connect Freighter wallet → enter a beneficiary's Stellar address → click **Issue Credential**
2. The server signs a credential binding the Merkle witness to that specific wallet
3. Download or copy the credential JSON — share it privately with the beneficiary
4. Beneficiary visits `/claim` → connects Freighter → uploads/pastes the credential
5. Signature is verified client-side — only the correct wallet can use this credential
6. Click **Generate ZK Proof & Claim →** — Groth16 proof generates in browser (~15–30 s)
7. Freighter signs the transaction — lands on Stellar testnet with a real XLM payout
8. Try to claim again with the same credential → blocked on-chain: **nullifier already used**

> The secret inside the credential never leaves the beneficiary's browser. All computation is WebAssembly.

## Deployed Contracts (Stellar Testnet)

| Contract | Address |
|---|---|
| AidShield Disbursement v5 | `CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2` |
| Groth16 BLS12-381 Verifier | `CDANBD2PG5XAQYH57ERPSTLRCKODHKKGEPI7OSDEZR5EQ237KHYSELEE` |
| XLM Native SAC (testnet) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

**Campaign:** disbursement\_id `000…001` · merkle\_root `222cfdd7…` · 1 XLM per claim

Verify: [Disbursement](https://stellar.expert/explorer/testnet/contract/CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2) · [Verifier](https://stellar.expert/explorer/testnet/contract/CDANBD2PG5XAQYH57ERPSTLRCKODHKKGEPI7OSDEZR5EQ237KHYSELEE)

---

## How It Works

```
Aid operator builds a Poseidon Merkle tree of beneficiary secrets (off-chain)
        ↓
Merkle root committed to Soroban disbursement contract
        ↓
Operator issues signed credentials — each binds a secret + Merkle witness
to a specific beneficiary wallet via Ed25519 signature (POST /api/issue-credential)
        ↓
Beneficiary loads credential in browser → signature verified locally
        ↓
circom circuit runs in-browser via snarkjs WASM (Groth16 · BLS12-381):
  ├─ Private inputs:  secret, merkle_path[8], path_indices[8]
  └─ Public inputs:   disbursement_id, merkle_root, nullifier, claimant_address

Constraint 1 — Merkle membership:
  leaf = Poseidon(secret)  →  merkle_verify(leaf, path, indices) == merkle_root

Constraint 2 — Nullifier correctness:
  nullifier = Poseidon(secret, disbursement_id, claimant_address, 1)
        ↓
384-byte Groth16 proof submitted to Stellar testnet
        ↓
AidShield Verifier contract:
  └─ bls.pairing_check(g1s, g2s)  — native BLS12-381 host function on Soroban ✓
        ↓
AidShield Disbursement contract:
  ├─ disbursement_id matches campaign ✓
  ├─ merkle_root matches on-chain value ✓
  ├─ nullifier is fresh (written to persistent storage after claim) ✓
  └─ claimant_address matches transaction signer ✓
        ↓
XLM released to beneficiary via Stellar Asset Contract
```

## What's On-Chain

| Data | On-chain? |
|---|---|
| Beneficiary name / ID | ❌ Never |
| Beneficiary list | ❌ Never |
| Claim secret | ❌ Never |
| Merkle root (commitment to approved list) | ✅ Yes |
| Nullifier (one-time claim token, post-claim) | ✅ Yes |
| Claim event (nullifier + amount, no identity) | ✅ Yes |

## ZK Proof Details

| Property | Value |
|---|---|
| Proof system | Groth16 (snarkjs) |
| Elliptic curve | BLS12-381 |
| Circuit language | circom 2.1 |
| Hash function | Poseidon (BLS12-381 scalar field) |
| Merkle tree | 8 levels · 256 slots |
| Proof size | **384 bytes** (G1 96 + G2 192 + G1 96, uncompressed) |
| Public inputs | 4 × 32 bytes = 128 bytes |
| On-chain verification | Native `bls.pairing_check` host function on Soroban |
| Proving location | Browser WASM (secret never leaves device) |
| Proving time | ~15–30 s (single-thread WASM) |

## Tech Stack

| Layer | Technology |
|---|---|
| ZK Circuit | circom 2.1 + snarkjs (Groth16 / BLS12-381) |
| Proving backend | `snarkjs` — runs in browser via WebAssembly |
| Hash function | Poseidon (BLS12-381 scalar field) — matches circomlibjs |
| Smart contracts | Soroban (Rust), soroban-sdk v22, Protocol 22 |
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Credential signing | Ed25519 via Stellar SDK Keypair (server-side only) |
| Wallet | Freighter (Stellar) |
| Token payout | Native XLM via Stellar Asset Contract (SAC) |
| Merkle tools | Custom Poseidon Merkle builder (TypeScript) |

## Project Structure

```
zk-aidshield/
├─ apps/
│  └─ web/                             # Next.js frontend
│     ├─ src/app/claim/                # Beneficiary claim flow (client-side proving)
│     ├─ src/app/admin/                # Operator dashboard + credential issuance
│     ├─ src/app/audit/                # Trust model & limitations
│     ├─ src/app/api/issue-credential/ # POST API — signs credentials (server-side)
│     ├─ src/lib/prover.ts             # generateProof() — Groth16 in WASM
│     ├─ src/lib/credential.ts         # Credential types + signature verification
│     ├─ src/lib/soroban.ts            # Soroban RPC calls
│     └─ public/
│        ├─ circuit.wasm               # Compiled circom circuit (2.3 MB)
│        └─ circuit_final.zkey         # Groth16 proving key (3.5 MB)
├─ circuits/
│  └─ aidshield-groth16/              # circom circuit
│     └─ aidshield.circom             # Merkle membership + Poseidon nullifier
├─ contracts/
│  ├─ disbursement/                   # Soroban: nullifier registry, payout logic
│  └─ verifier-groth16/               # Soroban: Groth16 BLS12-381 verifier
├─ packages/
│  └─ merkle-tools/                   # Poseidon Merkle tree + campaign generator
│     ├─ src/generate-campaign.ts     # Generates secrets + paths → campaign.json
│     └─ campaign.json                # ⚠ GITIGNORED — contains private secrets
└─ scripts/
   ├─ deploy-groth16.sh               # Deploy + initialize verifier + disbursement
   └─ init-verifier.sh                # Initialize verifier with VK + link contracts
```

> **Security note:** `campaign.json` contains private claim secrets. It is `.gitignore`d and must **never** be committed or shared publicly.

## Running Locally

**Prerequisites:** Node.js ≥ 20, pnpm, Freighter browser extension (set to Testnet)

```bash
# 1. Start the web app
cd apps/web
pnpm install
pnpm dev
# Open http://localhost:3000
```

```bash
# 2. Generate a new campaign (creates campaign.json — keep private)
cd packages/merkle-tools
pnpm generate
```

```bash
# 3. Test Soroban contracts
cd contracts/disbursement && cargo test
cd contracts/verifier-groth16 && cargo test
```

```bash
# 4. Deploy contracts to testnet
./scripts/deploy-groth16.sh
```

## Credential System

The operator's API route (`POST /api/issue-credential`) signs a credential JSON with an Ed25519 key. The signing key lives only on the server — it is never bundled into the frontend.

Each credential contains:
- `version`, `campaign_id`, `claimant_address` — binding fields
- `secret`, `merkle_path`, `path_indices` — proof witness (private to beneficiary)
- `issued_at`, `expires_at` — validity window
- `issuer_public_key`, `issuer_signature` — Ed25519 authentication

The claim frontend verifies the signature before generating any proof. An invalid, expired, or wrong-wallet credential is rejected immediately — the secret is never handed to the prover.

## Trust Model

See [`/audit`](http://localhost:3000/audit) for the full trust model breakdown, including:
- What is enforced on-chain vs. off-chain
- Attack resistance analysis (replay, forgery, wallet-switching)
- Known limitations at hackathon scope

---

Built for **Stellar Hacks: Real-World ZK** · DoraHacks · June 2026

> Testnet prototype — do not use with real funds.
