#!/usr/bin/env bash
# Deploy the Groth16 BLS12-381 verifier to Stellar testnet.
#
# Prerequisites (run ONCE before this script):
#   1. Install circom:
#        git clone https://github.com/iden3/circom.git /tmp/circom
#        cd /tmp/circom && cargo build --release
#        cp target/release/circom ~/.local/bin/
#   2. Run circuit setup:
#        cd circuits/aidshield-groth16 && npm install && bash setup.sh
#   3. Copy circuit artifacts to Next.js public folder:
#        cp circuits/aidshield-groth16/build/circuit.wasm       apps/web/public/circuit.wasm
#        cp circuits/aidshield-groth16/build/circuit_final.zkey  apps/web/public/circuit_final.zkey
#   4. Regenerate campaign (Poseidon BLS12-381 hashes):
#        cd packages/merkle-tools && npm install && npm run generate
#        # then update MERKLE_ROOT, ISSUER_KEY_ID, and VERIFIER_CONTRACT_ID in frontend env/constants
#   5. Call update_root and add_issuer on the disbursement contract
#
# Usage:
#   export ADMIN_SECRET_KEY=<admin-secret-key>
#   bash scripts/deploy-groth16.sh
set -euo pipefail

NETWORK="testnet"
RPC="https://soroban-testnet.stellar.org"
DISBURSEMENT_CONTRACT="CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2"
VK_JSON="circuits/aidshield-groth16/build/verification_key.json"
WASM="contracts/verifier-groth16/target/wasm32v1-none/release/aidshield_verifier_groth16.wasm"

if [ -z "${ADMIN_SECRET_KEY:-}" ]; then
  echo "Set ADMIN_SECRET_KEY=<admin-secret-key> before running this script"
  exit 1
fi

if [ ! -f "$VK_JSON" ]; then
  echo "❌  $VK_JSON not found — run setup.sh first"
  exit 1
fi

echo "=== Step 1: Build Groth16 verifier WASM ==="
(cd contracts/verifier-groth16 && source "$HOME/.cargo/env" && cargo build --target wasm32v1-none --release)
echo "✓ WASM built"

echo ""
echo "=== Step 2: Deploy verifier contract ==="
VERIFIER_ID=$(stellar contract deploy \
  --wasm "$WASM" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC")
echo "✓ Verifier deployed: $VERIFIER_ID"

echo ""
echo "=== Step 3: Parse verification key ==="
python3 - "$VK_JSON" <<'PYEOF'
import json, sys, base64

def bn_to_soroban_hex(pt, size=48):
    """Convert a decimal string field element to big-endian hex of 'size' bytes."""
    v = int(pt)
    return v.to_bytes(size, 'big').hex()

G1_INFINITY = "40" + ("00" * 95)
G2_INFINITY = "40" + ("00" * 191)

def is_zero(v):
    if isinstance(v, list):
        return all(int(x) == 0 for x in v)
    return int(v) == 0

def is_one(v):
    if isinstance(v, list):
        return int(v[0]) == 1 and all(int(x) == 0 for x in v[1:])
    return int(v) == 1

with open(sys.argv[1]) as f:
    vk = json.load(f)

# G1: be_bytes(X, 48) || be_bytes(Y, 48) = 96 bytes.
# Projective infinity is encoded with the Soroban BLS12-381 infinity flag.
def g1_hex(pt):
    if len(pt) >= 3:
        if is_zero(pt[2]):
            return G1_INFINITY
        if not is_one(pt[2]):
            raise SystemExit(f"Unsupported projective G1 z-coordinate: {pt[2]}")
    return bn_to_soroban_hex(pt[0]) + bn_to_soroban_hex(pt[1])

# G2: be_bytes(X_c1, 48) || be_bytes(X_c0, 48) || be_bytes(Y_c1, 48) || be_bytes(Y_c0, 48) = 192 bytes.
def g2_hex(pt):
    if len(pt) >= 3:
        if is_zero(pt[2]):
            return G2_INFINITY
        if not is_one(pt[2]):
            raise SystemExit(f"Unsupported projective G2 z-coordinate: {pt[2]}")
    return (bn_to_soroban_hex(pt[0][1]) + bn_to_soroban_hex(pt[0][0]) +
            bn_to_soroban_hex(pt[1][1]) + bn_to_soroban_hex(pt[1][0]))

alpha_hex  = g1_hex(vk["vk_alpha_1"])
beta_hex   = g2_hex(vk["vk_beta_2"])
gamma_hex  = g2_hex(vk["vk_gamma_2"])
delta_hex  = g2_hex(vk["vk_delta_2"])
ic_hex     = "".join(g1_hex(ic) for ic in vk["IC"])

print(f"VK_ALPHA={alpha_hex}")
print(f"VK_BETA={beta_hex}")
print(f"VK_GAMMA={gamma_hex}")
print(f"VK_DELTA={delta_hex}")
print(f"VK_IC={ic_hex}")
PYEOF

# Source the VK values into shell variables
eval $(python3 - "$VK_JSON" <<'PYEOF'
import json, sys

G1_INFINITY = "40" + ("00" * 95)
G2_INFINITY = "40" + ("00" * 191)

def bn_to_hex(pt, size=48):
    return int(pt).to_bytes(size, 'big').hex()

def is_zero(v):
    if isinstance(v, list):
        return all(int(x) == 0 for x in v)
    return int(v) == 0

def is_one(v):
    if isinstance(v, list):
        return int(v[0]) == 1 and all(int(x) == 0 for x in v[1:])
    return int(v) == 1

def g1_hex(pt):
    if len(pt) >= 3:
        if is_zero(pt[2]):
            return G1_INFINITY
        if not is_one(pt[2]):
            raise SystemExit(f"Unsupported projective G1 z-coordinate: {pt[2]}")
    return bn_to_hex(pt[0]) + bn_to_hex(pt[1])

def g2_hex(pt):
    if len(pt) >= 3:
        if is_zero(pt[2]):
            return G2_INFINITY
        if not is_one(pt[2]):
            raise SystemExit(f"Unsupported projective G2 z-coordinate: {pt[2]}")
    return (bn_to_hex(pt[0][1]) + bn_to_hex(pt[0][0]) +
            bn_to_hex(pt[1][1]) + bn_to_hex(pt[1][0]))

with open(sys.argv[1]) as f:
    vk = json.load(f)

print(f"VK_ALPHA={g1_hex(vk['vk_alpha_1'])}")
print(f"VK_BETA={g2_hex(vk['vk_beta_2'])}")
print(f"VK_GAMMA={g2_hex(vk['vk_gamma_2'])}")
print(f"VK_DELTA={g2_hex(vk['vk_delta_2'])}")
print(f"VK_IC={''.join(g1_hex(ic) for ic in vk['IC'])}")
PYEOF
)

echo ""
echo "=== Step 4: Initialize verifier with VK ==="
stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  -- initialize \
  --vk_alpha "$VK_ALPHA" \
  --vk_beta  "$VK_BETA" \
  --vk_gamma "$VK_GAMMA" \
  --vk_delta "$VK_DELTA" \
  --vk_ic    "$VK_IC"
echo "✓ VK stored on-chain"

echo ""
echo "=== Step 5: Point disbursement contract at new verifier ==="
stellar contract invoke \
  --id "$DISBURSEMENT_CONTRACT" \
  --source "$ADMIN_SECRET_KEY" \
  --network "$NETWORK" \
  --rpc-url "$RPC" \
  -- set_verifier \
  --verifier_address "$VERIFIER_ID"
echo "✓ Disbursement → Groth16 verifier set"

echo ""
echo "=== Done! ==="
echo "Groth16 verifier contract: $VERIFIER_ID"
echo ""
echo "Next steps:"
echo "  1. Update VERIFIER_CONTRACT_ID in apps/web/src/lib/constants.ts to: $VERIFIER_ID"
echo "  2. Call set_paused false on disbursement contract to enable claims"
echo "  3. Deploy updated frontend"
