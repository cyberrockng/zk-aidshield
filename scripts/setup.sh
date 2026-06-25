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
#   export ADMIN_SECRET_KEY=<admin-secret-key>          # funded testnet admin wallet
#   export FUND_AMOUNT_XLM=50             # XLM to seed into escrow (optional, default 50)
#   bash scripts/setup.sh
#
# For circuit rebuild only (slow — ~10 min):
#   bash circuits/aidshield-groth16/setup.sh

set -euo pipefail

echo "scripts/setup.sh now delegates to the Phase 4 issuer/expiry-bound deployment flow."
exec bash scripts/setup-phase4.sh
