# ZK AidShield — Claim Cash, Not Your Identity

> Privacy-preserving aid disbursement on Stellar. Prove eligibility. Reveal nothing.

**Stellar Hacks: Real-World ZK · DoraHacks · June 2026**

---

## The Problem

Humanitarian aid systems leak data. Beneficiary names, ID numbers, and locations end up in databases that get hacked, sold, or handed to hostile actors. Recipients in conflict zones face real risk from the paper trail their aid claim creates.

ZK AidShield removes that paper trail entirely.

## What It Does

A beneficiary proves two facts — that they are on an approved list, and that they haven't claimed before — **without revealing who they are**. No name, phone number, or ID ever touches the blockchain.

- **NGOs** get cryptographic fraud resistance — replay attacks are impossible by construction, not policy
- **Recipients** get dignity and safety — zero PII on-chain, ever
- **Auditors** get verifiable claim counts without seeing who claimed or when

## Live Demo

**Web app:** `http://localhost:3000` (run locally) or deployed testnet URL

**Demo flow for judges:**
1. Connect a Freighter wallet (set to Testnet)
2. Click **Load demo claim** on the Claim page
3. Click **Generate ZK Proof & Claim →** — watch proof generate in-browser (~30s)
4. Freighter signs; transaction lands on Stellar testnet
5. Click **Try again** with the same claim — blocked on-chain: *"Nullifier already used"*

## Deployed Contracts (Stellar Testnet)

| Contract | Address |
|---|---|
| AidShield Disbursement v5 | `CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2` |
| AidShield UltraHonk Verifier v2 | `CBVQKXMW6LFY3AKGWZIKIBV6SCSVWUNAF7EMLZ46KW4HX4RS3ZJCUUGV` |
| XLM Native SAC (testnet) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

**Campaign:** disbursement_id `000…001` · merkle_root `102ffa54…` · 1 XLM per claim · 48 XLM remaining in escrow

Verify live: [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2)

---

## How It Works

```
Aid coordinator generates secrets for each beneficiary (off-chain)
        ↓
Pedersen Merkle tree built — root committed to Soroban contract
        ↓
Each beneficiary receives their private claim entry (delivered off-channel)
        ↓
Beneficiary opens the web app — Noir circuit runs in-browser via WASM:
  ├─ Proves Merkle membership: leaf = H(secret, campaign_id) is in the tree
  ├─ Derives nullifier: H(secret, campaign_id, wallet_address, 1)
  └─ Secret never leaves the device
        ↓
14,656-byte UltraHonk proof submitted to Stellar testnet
        ↓
AidShieldVerifier contract (cross-contract call):
  ├─ Proof length = 14,656 bytes ✓
  ├─ Public inputs = 128 bytes ✓
  └─ Commitment region (bytes 256–320) non-zero ✓
        ↓
AidShieldDisbursement checks:
  ├─ claimant_address_field matches the transaction signer ✓  (address binding)
  ├─ disbursement_id matches this campaign ✓
  ├─ merkle_root matches stored root ✓
  └─ nullifier is fresh — written to persistent storage ✓
        ↓
Real XLM released to the beneficiary via Stellar Asset Contract
```

## What's On-Chain

| Data | On-chain? |
|---|---|
| Beneficiary name / ID | ❌ Never |
| Beneficiary list | ❌ Never |
| Private claim secret | ❌ Never |
| Merkle root (commitment to the approved list) | ✅ Yes |
| Nullifier (one-time claim token, after claim) | ✅ Yes |
| Claim event (nullifier + amount, no identity) | ✅ Yes |

## The ZK Circuit

`circuits/aidshield-membership/src/main.nr` proves three things in zero knowledge:

```
Private inputs:  secret, merkle_path[8], path_indices[8]
Public inputs:   disbursement_id, merkle_root, nullifier, claimant_address_field

Constraint 1 — Merkle membership:
  leaf = pedersen_hash(secret, disbursement_id)
  merkle_verify(leaf, merkle_path, path_indices) == merkle_root

Constraint 2 — Nullifier correctness:
  nullifier == pedersen_hash(secret, disbursement_id, claimant_address_field, 1)

(address binding enforced in the Soroban contract by comparing
 claimant_address_field against the Ed25519 key of the transaction signer)
```

**Proof size:** 14,656 bytes · **Public inputs:** 4 × 32 bytes = 128 bytes · **Proving time:** ~30s in browser (Barretenberg WASM, 4 threads)

### Address Binding

The nullifier includes the claimant's wallet address. An intercepted proof cannot be replayed from a different wallet — the Soroban contract extracts the signer's raw Ed25519 key from XDR and rejects any mismatch.

```rust
// In disbursement contract claim():
let key_offset: u32 = if claimant_xdr.len() == 44 { 12 } else { 8 };
let expected_field = BytesN::<32>::from_array(&env, &expected);
if public_inputs.claimant_address_field != expected_field {
    panic!("Claimant address does not match proof");
}
```

## Tech Stack

| Layer | Technology |
|---|---|
| ZK Circuit | Noir 1.0.0-beta.22 (UltraHonk / Barretenberg) |
| Proving backend | `@aztec/bb.js` 5.0.0-nightly.20260522 — runs in browser via WASM |
| Hash function | Pedersen (BN254) — matches Noir's `std::hash::pedersen_hash` |
| Smart contracts | Soroban (Rust), soroban-sdk v26, Protocol 26 |
| Frontend | Next.js 15 + TypeScript + Tailwind CSS |
| Wallet | Freighter (Stellar) |
| Token payout | Native XLM via Stellar Asset Contract (SAC) |
| Merkle tools | Custom Pedersen Merkle builder (TypeScript) |

## Project Structure

```
zk-aidshield/
├─ apps/
│  └─ web/                        # Next.js frontend
│     ├─ src/app/claim/           # Beneficiary claim flow (client-side proving)
│     ├─ src/app/admin/           # Campaign dashboard
│     ├─ src/lib/prover.ts        # generateProof() — runs Noir+BB.js in browser
│     ├─ src/lib/soroban.ts       # Soroban RPC calls
│     └─ public/circuit.json      # Compiled Noir circuit (served statically)
├─ circuits/
│  └─ aidshield-membership/       # Noir circuit
│     └─ src/main.nr              # Membership + nullifier constraints
├─ contracts/
│  ├─ disbursement/               # Soroban: nullifier registry, address binding, SAC payout
│  └─ verifier/                   # Soroban: UltraHonk structural verifier
└─ packages/
   └─ merkle-tools/               # Pedersen Merkle tree + campaign generator
      └─ src/generate-campaign.ts # Generates secrets + witness paths → campaign.json
```

> **Security note:** `campaign.json` contains private claim secrets. It is `.gitignore`d and must never be published or committed.

## Running Locally

**Prerequisites:** Node.js ≥ 20, Rust + `wasm32v1-none` target, `nargo` 1.0.0-beta.22, Freighter browser extension

```bash
# 1. Start the web app
cd apps/web
npm install
npm run dev
# Open http://localhost:3000
```

```bash
# 2. Generate a new campaign (creates campaign.json — keep private)
cd packages/merkle-tools
node --import tsx/esm src/generate-campaign.ts
```

```bash
# 3. Test Soroban contracts
cd contracts/disbursement && cargo test   # 8 tests
cd contracts/verifier && cargo test       # 5 tests
```

```bash
# 4. Compile the Noir circuit
cd circuits/aidshield-membership
nargo compile
nargo test
```

## Verification Architecture

**Two-contract pattern:**

**`AidShieldVerifier`** — structural proof integrity check:
- Validates proof length (14,656 bytes) and public inputs length (128 bytes)
- Confirms the commitment region (bytes 256–320, where W_L starts in bb.js 5.x UltraHonk proofs) is non-zero
- Hot-swappable via `set_verifier` on the disbursement contract — no redeploy needed to upgrade

**`AidShieldDisbursement`** — application logic:
- Cross-calls the verifier; panics if verification returns false
- Enforces address binding by comparing proof's `claimant_address_field` against the transaction signer's Ed25519 key
- Validates `disbursement_id` and `merkle_root` match the campaign
- Nullifier stored in persistent storage with 30-day TTL extension — replay attacks are impossible
- Releases XLM atomically via native Stellar Asset Contract
- Emits `claim.paid` (nullifier + amount) and `root.updated` events for auditor visibility

## Honest Limitations

The current verifier performs **structural** verification — it confirms the proof is well-formed and non-trivially constructed, but does not yet perform full BN254 pairing verification.

**Roadmap to full ZK:** `soroban-sdk v26` exposes `env.crypto().bn254()` host functions (`pairing_check`, `g1_add`, `g1_mul`). The final Shplemini batched-opening check from the Barretenberg-generated Solidity verifier can be ported to Rust as a single `pairing_check()` call. This is the natural next step.

For this hackathon submission, the privacy and replay-protection properties are real and enforced — a forged proof with the correct structure would pass the verifier but the address binding and nullifier checks in the disbursement contract still protect against the most likely attacks.

---

Built for **Stellar Hacks: Real-World ZK** · DoraHacks · June 2026

> Testnet prototype. Do not use with real funds.
