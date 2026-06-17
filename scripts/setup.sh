#!/usr/bin/env bash
# ZK AidShield — full deployment setup sequence
#
# Runs the complete pipeline from a blank slate to a live testnet campaign:
#   1. Generate Poseidon BLS12-381 Merkle campaign
#   2. Build + deploy Groth16 verifier contract
#   3. Initialize verifier with VK and link to disbursement contract
#   4. Update the disbursement contract's Merkle root
#   5. Unpause claims
#   6. Fund the escrow
#
# Prerequisites:
#   - Node.js ≥ 20 + pnpm (or npm)
#   - Rust + wasm32v1-none target: rustup target add wasm32v1-none
#   - Stellar CLI: cargo install --locked stellar-cli
#   - circom (for circuit rebuild only): see circuits/aidshield-groth16/setup.sh
#   - ADMIN_SECRET_KEY: secret key of the funded testnet admin wallet
#   - campaign.json: generated in step 1 (gitignored — never commit)
#
# Usage:
#   export ADMIN_SECRET_KEY=S...          # funded testnet admin wallet
#   export FUND_AMOUNT_XLM=50             # XLM to seed into escrow (optional, default 50)
#   bash scripts/setup.sh
#
# For circuit rebuild only (slow — ~10 min):
#   bash circuits/aidshield-groth16/setup.sh

set -euo pipefail

FUND_AMOUNT_XLM="${FUND_AMOUNT_XLM:-50}"
NETWORK="testnet"
RPC="https://soroban-testnet.stellar.org"
DISBURSEMENT_CONTRACT="CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2"

if [ -z "${ADMIN_SECRET_KEY:-}" ]; then
  echo "❌  ADMIN_SECRET_KEY is not set."
  echo "    Export it before running this script:"
  echo "    export ADMIN_SECRET_KEY=S..."
  exit 1
fi

# Derive public key from secret
ADMIN_PUBLIC=$(stellar keys show "$ADMIN_SECRET_KEY" 2>/dev/null \
  || stellar keys address default 2>/dev/null \
  || echo "")

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         ZK AidShield — Full Deployment Setup                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Generate campaign ─────────────────────────────────────────────────
echo "▸ Step 1/5  Generate Merkle campaign (Poseidon BLS12-381)"
echo "  Campaign file will be created at: packages/merkle-tools/campaign.json"
echo "  ⚠  Keep campaign.json private — it contains claim secrets."

if [ -f "packages/merkle-tools/campaign.json" ]; then
  echo "  → campaign.json already exists. Skipping generation."
  echo "    Delete it to regenerate: rm packages/merkle-tools/campaign.json"
else
  (cd packages/merkle-tools && node --import tsx/esm src/generate-campaign.ts --seed)
  echo "  ✓ Campaign generated"
fi

MERKLE_ROOT=$(node -e "const c=require('./packages/merkle-tools/campaign.json'); console.log(c.merkle_root)" 2>/dev/null || echo "")
if [ -z "$MERKLE_ROOT" ]; then
  echo "  ❌ Could not read merkle_root from campaign.json"
  exit 1
fi
echo "  Merkle root: $MERKLE_ROOT"

# ── Step 2: Deploy Groth16 verifier ──────────────────────────────────────────
echo ""
echo "▸ Step 2/5  Deploy + initialize Groth16 verifier contract"
bash scripts/deploy-groth16.sh

# deploy-groth16.sh prints the verifier ID — capture it
# If not captured, caller can paste the ID manually
echo "  ✓ Verifier deployed and initialized"

# ── Step 3: Update Merkle root on disbursement contract ──────────────────────
echo ""
echo "▸ Step 3/5  Update Merkle root on disbursement contract"
stellar contract invoke \
  --id "$DISBURSEMENT_CONTRACT" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  -- update_root \
  --new_root "$MERKLE_ROOT"
echo "  ✓ Merkle root updated: $MERKLE_ROOT"

# ── Step 4: Unpause claims ───────────────────────────────────────────────────
echo ""
echo "▸ Step 4/5  Unpause claims"
stellar contract invoke \
  --id "$DISBURSEMENT_CONTRACT" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  -- set_paused \
  --paused false
echo "  ✓ Claims unpaused"

# ── Step 5: Fund escrow ───────────────────────────────────────────────────────
echo ""
echo "▸ Step 5/5  Fund escrow with ${FUND_AMOUNT_XLM} XLM"
FUND_STROOPS=$(( FUND_AMOUNT_XLM * 10000000 ))
stellar contract invoke \
  --id "$DISBURSEMENT_CONTRACT" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  -- fund \
  --funder "$ADMIN_PUBLIC" \
  --amount "$FUND_STROOPS"
echo "  ✓ Escrow funded: ${FUND_AMOUNT_XLM} XLM"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                   Setup complete!                           ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Start the frontend:  cd apps/web && npm run dev"
echo "  2. Open http://localhost:3000/admin"
echo "  3. Issue a credential to a beneficiary wallet"
echo "  4. Beneficiary loads credential at http://localhost:3000/claim"
echo ""
echo "Merkle root committed:  $MERKLE_ROOT"
echo "Disbursement contract:  $DISBURSEMENT_CONTRACT"
echo ""
echo "⚠  campaign.json contains private secrets. Never commit or share it."
