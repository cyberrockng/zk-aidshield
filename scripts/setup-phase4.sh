#!/usr/bin/env bash
# ZK AidShield Phase 4 — deploy upgraded issuer/expiry-bound protocol.
#
# Deploys a fresh verifier and a fresh disbursement contract. The older deployed
# disbursement contract cannot enforce issuer registry or on-chain expiry because
# those fields changed the contract interface and Groth16 public inputs.
#
# Prerequisites:
#   export ADMIN_SECRET_KEY=S...
#   bash circuits/aidshield-groth16/setup.sh
#   cd packages/merkle-tools && npm run generate
#
# Optional:
#   export FUND_AMOUNT_XLM=50

set -euo pipefail

NETWORK="${NETWORK:-testnet}"
RPC="${RPC:-https://soroban-testnet.stellar.org}"
NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
FUND_AMOUNT_XLM="${FUND_AMOUNT_XLM:-50}"
XLM_SAC="${XLM_SAC:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
VK_JSON="circuits/aidshield-groth16/build/verification_key.json"
VERIFIER_WASM="contracts/verifier-groth16/target/wasm32v1-none/release/aidshield_verifier_groth16.wasm"
DISBURSEMENT_WASM="contracts/disbursement/target/wasm32v1-none/release/aidshield.wasm"
CAMPAIGN_JSON="packages/merkle-tools/campaign.json"

if [ -z "${ADMIN_SECRET_KEY:-}" ]; then
  echo "Set ADMIN_SECRET_KEY=S... before running this script"
  exit 1
fi

if [ ! -f "$VK_JSON" ]; then
  echo "$VK_JSON not found. Building circuit artifacts..."
  (cd circuits/aidshield-groth16 && bash setup.sh)
fi

if [ ! -f "$CAMPAIGN_JSON" ]; then
  echo "$CAMPAIGN_JSON not found. Generating demo seed campaign..."
  (cd packages/merkle-tools && npm run seed)
fi

ADMIN_PUBLIC=$(stellar keys address "$ADMIN_SECRET_KEY" 2>/dev/null \
  || stellar keys public-key "$ADMIN_SECRET_KEY" 2>/dev/null \
  || echo "")

if [ -z "$ADMIN_PUBLIC" ]; then
  echo "Could not derive admin public key from ADMIN_SECRET_KEY"
  exit 1
fi

DISBURSEMENT_ID=$(node -e "const c=require('./$CAMPAIGN_JSON'); console.log(c.disbursement_id)")
MERKLE_ROOT=$(node -e "const c=require('./$CAMPAIGN_JSON'); console.log(c.merkle_root)")
PAYOUT_STROOPS=$(node -e "const c=require('./$CAMPAIGN_JSON'); console.log(c.payout_amount_stroops)")
ISSUER_KEY_ID=$(node -e "const c=require('./$CAMPAIGN_JSON'); console.log(c.issuer_key_id)")

echo "=== Phase 4 deploy ==="
echo "Admin:          $ADMIN_PUBLIC"
echo "Disbursement:   $DISBURSEMENT_ID"
echo "Merkle root:    $MERKLE_ROOT"
echo "Payout stroops: $PAYOUT_STROOPS"
echo "Issuer key id:  $ISSUER_KEY_ID"

echo ""
echo "=== Build contracts ==="
(cd contracts/verifier-groth16 && source "$HOME/.cargo/env" && cargo build --target wasm32v1-none --release)
(cd contracts/disbursement && source "$HOME/.cargo/env" && cargo build --target wasm32v1-none --release)

echo ""
echo "=== Deploy verifier ==="
VERIFIER_ID=$(stellar contract deploy \
  --wasm "$VERIFIER_WASM" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE")
echo "Verifier: $VERIFIER_ID"

echo ""
echo "=== Parse verification key ==="
eval "$(python3 - "$VK_JSON" <<'PYEOF'
import json, sys

def bn_to_hex(pt, size=48):
    return int(pt).to_bytes(size, 'big').hex()

def g1_hex(pt):
    return bn_to_hex(pt[0]) + bn_to_hex(pt[1])

def g2_hex(pt):
    return (bn_to_hex(pt[0][1]) + bn_to_hex(pt[0][0]) +
            bn_to_hex(pt[1][1]) + bn_to_hex(pt[1][0]))

with open(sys.argv[1]) as f:
    vk = json.load(f)

if len(vk["IC"]) != 7:
    raise SystemExit(f"Expected 7 IC points for 6 public inputs, got {len(vk['IC'])}")

print(f"VK_ALPHA={g1_hex(vk['vk_alpha_1'])}")
print(f"VK_BETA={g2_hex(vk['vk_beta_2'])}")
print(f"VK_GAMMA={g2_hex(vk['vk_gamma_2'])}")
print(f"VK_DELTA={g2_hex(vk['vk_delta_2'])}")
print(f"VK_IC={''.join(g1_hex(ic) for ic in vk['IC'])}")
PYEOF
)"

echo ""
echo "=== Initialize verifier ==="
stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --vk_alpha "$VK_ALPHA" \
  --vk_beta "$VK_BETA" \
  --vk_gamma "$VK_GAMMA" \
  --vk_delta "$VK_DELTA" \
  --vk_ic "$VK_IC"

echo ""
echo "=== Deploy disbursement ==="
DISBURSEMENT_CONTRACT=$(stellar contract deploy \
  --wasm "$DISBURSEMENT_WASM" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE")
echo "Disbursement: $DISBURSEMENT_CONTRACT"

echo ""
echo "=== Initialize disbursement ==="
stellar contract invoke \
  --id "$DISBURSEMENT_CONTRACT" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- initialize \
  --admin "$ADMIN_PUBLIC" \
  --disbursement_id "$DISBURSEMENT_ID" \
  --merkle_root "$MERKLE_ROOT" \
  --payout_amount "$PAYOUT_STROOPS" \
  --token_address "$XLM_SAC" \
  --verifier_address "$VERIFIER_ID"

echo ""
echo "=== Register issuer ==="
stellar contract invoke \
  --id "$DISBURSEMENT_CONTRACT" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- add_issuer \
  --issuer_key_id "$ISSUER_KEY_ID"

echo ""
echo "=== Unpause claims ==="
stellar contract invoke \
  --id "$DISBURSEMENT_CONTRACT" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- set_paused \
  --paused false

echo ""
echo "=== Fund escrow ==="
FUND_STROOPS=$(( FUND_AMOUNT_XLM * 10000000 ))
stellar contract invoke \
  --id "$DISBURSEMENT_CONTRACT" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  --network-passphrase "$NETWORK_PASSPHRASE" \
  -- fund \
  --funder "$ADMIN_PUBLIC" \
  --amount "$FUND_STROOPS"

VK_HASH=$(sha256sum "$VK_JSON" | awk '{print $1}')

echo ""
echo "=== Done ==="
echo "NEXT_PUBLIC_CONTRACT_ID=$DISBURSEMENT_CONTRACT"
echo "NEXT_PUBLIC_VERIFIER_CONTRACT_ID=$VERIFIER_ID"
echo "NEXT_PUBLIC_MERKLE_ROOT=$MERKLE_ROOT"
echo "NEXT_PUBLIC_DISBURSEMENT_ID=$DISBURSEMENT_ID"
echo "NEXT_PUBLIC_ISSUER_KEY_ID=$ISSUER_KEY_ID"
echo "NEXT_PUBLIC_VK_HASH=$VK_HASH"
