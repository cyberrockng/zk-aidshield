# ZK AidShield — Claim Aid, Not Your Identity

> Privacy-preserving humanitarian disbursement on Stellar. Prove eligibility with zero knowledge. Keep aid-list membership private.

**Stellar Hacks: Real-World ZK · DoraHacks · June 2026**

---

## The Problem

Humanitarian aid systems leak data. Names, ID numbers, and claim records end up in databases that get hacked, sold, or handed to hostile actors. In conflict zones, a paper trail can be lethal.

ZK AidShield removes the aid-list paper trail from public settlement — using real zero-knowledge cryptography, not just encryption.

## What It Does

A beneficiary proves two things — they are on an approved list, and they haven't claimed before — **without revealing their eligibility record or private credential**. No name, ID number, beneficiary database row, credential secret, or Merkle witness ever touches the blockchain.

- **Aid operators** get cryptographic fraud resistance: replay attacks are impossible by construction
- **Beneficiaries** get dignity and safety: no names, IDs, or aid-list entries on-chain
- **Auditors** get verifiable claim counts, escrow state, and payout events without seeing the private eligibility list

## Why This Can Win

ZK AidShield is a complete aid disbursement workflow, not only a ZK primitive demo:

- **Real payout path:** valid proof triggers an XLM transfer from Soroban escrow
- **Wallet-bound privacy:** credentials and nullifiers are bound to the claimant wallet without revealing identity
- **Fraud resistance:** double claims and wrong-wallet claims are blocked
- **Auditor visibility:** contracts, campaign root, VK hash, stats, non-PII issuance ledger, and trust boundaries are inspectable
- **Field-ready credential delivery:** operators can export JSON or passphrase-protected mobile QR credentials
- **Beneficiary receipts:** successful claims produce a local receipt with transaction hash, nullifier, amount, and campaign metadata
- **Production path:** documented next steps for issuer governance, vendor/voucher mode, and optional identity adapters

See [docs/JUDGING_NOTES.md](docs/JUDGING_NOTES.md), [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), and [docs/COMPETITIVE_ANALYSIS.md](docs/COMPETITIVE_ANALYSIS.md).

## Judge Demo Script

> **Setup:** Two browser windows — one as the **Operator** (Admin tab), one as the **Beneficiary** (Claim tab). Both need [Freighter](https://freighter.app) set to **Testnet**.

### Step 1 — Operator: Issue a Credential (~30 seconds)

1. Open `http://localhost:3000/admin` in browser A
2. Scroll to **Issue Beneficiary Credential**
3. Paste the beneficiary's Stellar address (or use your second Freighter account)
4. Click **Issue Credential**
5. A signed credential appears — enter a QR passphrase, then click **Download**, **Copy JSON**, or **Download QR**

> _What happened:_ The server signed a credential binding the Merkle witness (secret + path) to that specific wallet using Ed25519. The secret never left the server. The browser received a signed token.

### Step 2 — Beneficiary: Load and Verify (~5 seconds)

1. Open `http://localhost:3000/claim` in browser B
2. Connect Freighter — make sure it is the **same wallet** as the address in step 1
3. Enter the QR passphrase if using QR, then upload a credential file, scan a QR image, or paste the credential directly
4. Click **Verify & Load Credential**
5. You should see: `✓ Credential verified — slot #0`

> _What happened:_ The frontend verified the Ed25519 signature client-side, confirmed `claimant_address` matches the connected wallet, and checked the expiry. No server call was made.

### Step 3 — Beneficiary: Generate Proof (~15–30 seconds)

1. Click **Generate ZK Proof & Claim →**
2. Watch the spinning rings — a Groth16 BLS12-381 proof is being computed in your browser via WebAssembly
3. The progress bar shows an asymptotic estimate (proof generation has no intermediate callbacks)
4. When done: `✓ Groth16 proof (384 bytes): 0x…`

> _What happened:_ snarkjs ran the circom circuit in WASM. The secret is a private input — it never appears in the proof. The public outputs are: Merkle root, disbursement ID, nullifier (wallet-bound), and claimant address.

### Step 4 — On-chain Settlement (~10 seconds)

1. Freighter pops up — click **Approve**
2. The transaction is sent to Stellar testnet
3. Success screen: **"Aid claimed! 🎉"** with a link to Stellar Expert

> _What happened:_ The Soroban disbursement contract called the Groth16 verifier via `bls.pairing_check` (native BLS12-381 host function). The verifier confirmed the proof. The disbursement contract checked the nullifier is fresh, wrote it to persistent storage, and released 1 XLM from escrow.

### Step 5 — Replay Attack Demo (~5 seconds)

1. Click **Try again** on the success screen
2. Load the **same credential** again
3. Click **Generate ZK Proof & Claim →**
4. After proving, you will see: _"This claim has already been used — nullifier found on-chain."_

> _What happened:_ The nullifier `Poseidon(secret, disbursement_id, claimant_address, 1)` was stored permanently on-chain after the first claim. The contract rejected the duplicate before it could double-spend.

### Step 6 — Wrong Wallet Demo (optional, ~10 seconds)

1. In browser B, switch Freighter to a **different** wallet account
2. Paste the credential from Step 1 (which was issued to the original wallet)
3. Click **Verify & Load Credential**
4. Error: _"Credential issued to GXXXX… but your wallet is GYYY…"_

> _What happened:_ The signature check passed (the credential itself is valid), but the `claimant_address` field in the credential does not match the connected wallet. The credential is rejected before any proof is generated.

## Deployed Contracts (Stellar Testnet)

| Contract | Address |
|---|---|
| AidShield Disbursement Phase 4 | `CD3FMAN3VJ6W6AHCH7CS3GIV56OO7BKBH5H2DIXT2H4TDZOUSMSSSGRC` |
| Groth16 BLS12-381 Verifier Phase 4 | `CAVU2HNFWXALJG2FNFWZA4Y3WBV7VL5W7LBP4WYMZQFG26XHQNLTSAHQ` |
| XLM Native SAC (testnet) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

**Campaign (Phase 4 — wallet-, expiry-, and issuer-bound leaves):** disbursement\_id `000…001` · merkle\_root `6631aeab…` · 1 XLM per claim · 50 XLM escrow

> Phase 4 was deployed on Stellar testnet with the upgraded 6-public-input circuit and on-chain issuer/expiry enforcement.

Verify: [Disbursement](https://stellar.expert/explorer/testnet/contract/CD3FMAN3VJ6W6AHCH7CS3GIV56OO7BKBH5H2DIXT2H4TDZOUSMSSSGRC) · [Verifier](https://stellar.expert/explorer/testnet/contract/CAVU2HNFWXALJG2FNFWZA4Y3WBV7VL5W7LBP4WYMZQFG26XHQNLTSAHQ)

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
  └─ Public inputs:   disbursement_id, merkle_root, nullifier, claimant_address,
                      expires_at, issuer_key_id

Constraint 1 — Merkle membership (wallet-, expiry-, and issuer-bound leaf):
  leaf = Poseidon(secret, disbursement_id, claimant_address, expires_at, issuer_key_id)
  merkle_verify(leaf, path, indices) == merkle_root

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
  ├─ issuer_key_id is active in the issuer registry ✓
  ├─ expires_at has not passed according to ledger time ✓
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
| Public inputs | 6 × 32 bytes = 192 bytes |
| Circuit constraints | 2,576 non-linear constraints |
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
│     └─ circuit.circom               # Merkle membership + Poseidon nullifier
├─ contracts/
│  ├─ disbursement/                   # Soroban: nullifier registry, payout logic
│  └─ verifier-groth16/               # Soroban: Groth16 BLS12-381 verifier
├─ packages/
│  └─ merkle-tools/                   # Poseidon Merkle tree + campaign generator
│     ├─ src/generate-campaign.ts     # Generates secrets + paths → campaign.json
│     ├─ src/hash.test.ts             # 22-test suite: Poseidon leaf/nullifier/Merkle
│     ├─ demo-claim.sample.json       # Safe structural sample for judges/docs
│     └─ campaign.json                # ⚠ GITIGNORED — contains private secrets
└─ scripts/
   └─ deploy-groth16.sh               # Deploy + initialize verifier + disbursement
```

> **Security note:** `campaign.json` contains private claim secrets. It is `.gitignore`d and must **never** be committed or shared publicly.

## Running Locally

**Prerequisites:** Node.js ≥ 20, Freighter browser extension (set to Testnet)

```bash
# 1. Install dependencies and start the web app
cd apps/web
npm install
npm run dev
# Open http://localhost:3000
```

```bash
# 2. Run the frontend test suite (14 tests — credential + API logic)
cd apps/web
npm test
```

```bash
# 3. Generate a new campaign (creates campaign.json — keep private)
cd packages/merkle-tools
npm run generate
```

```bash
# 4. Test Soroban contracts
cd contracts/disbursement && cargo test
cd contracts/verifier-groth16 && cargo test
```

```bash
# 5. Full Phase 4 deployment to testnet (fresh verifier + fresh disbursement)
export ADMIN_SECRET_KEY=S...
bash scripts/setup-phase4.sh
```

```bash
# 6. Deploy only the Groth16 verifier (after circuit rebuild)
export ADMIN_SECRET_KEY=S...
bash scripts/deploy-groth16.sh
```

### Configuration

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp apps/web/.env.example apps/web/.env.local
# Edit .env.local — set contract addresses, keys, and campaign parameters
```

The app ships with testnet fallback values in `constants.ts`, so it works without `.env.local` for the deployed demo campaign.

Protected operator APIs do not ship with server-side fallbacks. Set `ISSUER_SECRET_KEY`, `ADMIN_API_SECRET`, and `LEDGER_HMAC_SECRET` in `apps/web/.env.local` before using `/admin` to issue credentials or inspect the local issuance ledger.

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

## Security Posture

AidShield keeps names, IDs, beneficiary-list membership, credential secrets, Merkle witnesses, and issuance records off-chain. Beneficiary credentials are wallet-bound and issuer-signed; claims are replay-protected by on-chain nullifiers; operator-only APIs require an admin secret; the local issuance ledger stores keyed HMAC identifiers instead of raw wallet addresses.

Public settlement still reveals the payout wallet, timing, amount, contract IDs, Merkle root, verifier key hash, and nullifier. This is the intended accountability layer on Stellar, not an anonymity guarantee for the final token transfer.

---

Built for **Stellar Hacks: Real-World ZK** · DoraHacks · June 2026

> Testnet prototype — do not use with real funds.
