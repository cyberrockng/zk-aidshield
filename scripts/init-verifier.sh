#!/usr/bin/env bash
# Initialize the already-deployed Groth16 verifier with the verification key.
# Run after setup.sh produces build/verification_key_v2.json.
set -euo pipefail

export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$HOME/.local/bin:$PATH"

VERIFIER_ID="CDANBD2PG5XAQYH57ERPSTLRCKODHKKGEPI7OSDEZR5EQ237KHYSELEE"
DISBURSEMENT_ID="CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2"
VK_JSON="circuits/aidshield-groth16/build/verification_key_v2.json"
ZKEY_SRC="circuits/aidshield-groth16/build/circuit_v2_final.zkey"
ZKEY_DST="apps/web/public/circuit_final.zkey"

if [ ! -f "$VK_JSON" ]; then
  echo "❌  $VK_JSON not found — run circuits/aidshield-groth16 setup pipeline first"
  exit 1
fi

echo "=== Checking IC points ==="
python3 -c "
import json, sys
with open('$VK_JSON') as f: vk = json.load(f)
ic_ok = any(pt[0] not in ('0','') for pt in vk['IC'][1:])
if not ic_ok:
    print('ERROR: IC points are still identity — ptau ceremony may be degenerate')
    sys.exit(1)
print('IC OK — non-trivial points found')
print('IC[1] x:', vk['IC'][1][0][:40], '...')
"

echo ""
echo "=== Parsing verification key ==="
eval $(python3 - "$VK_JSON" << 'PYEOF'
import json, sys
def bn(x, n=48): return int(x).to_bytes(n,'big').hex()
def g1(pt): return bn(pt[0]) + bn(pt[1])
# G2: X_c1 || X_c0 || Y_c1 || Y_c0  (snarkjs: pt[0]=[x_c0,x_c1], pt[1]=[y_c0,y_c1])
def g2(pt): return bn(pt[0][1]) + bn(pt[0][0]) + bn(pt[1][1]) + bn(pt[1][0])
with open(sys.argv[1]) as f: vk = json.load(f)
print(f"VK_ALPHA={g1(vk['vk_alpha_1'])}")
print(f"VK_BETA={g2(vk['vk_beta_2'])}")
print(f"VK_GAMMA={g2(vk['vk_gamma_2'])}")
print(f"VK_DELTA={g2(vk['vk_delta_2'])}")
print(f"VK_IC={''.join(g1(ic) for ic in vk['IC'])}")
PYEOF
)

echo "vk_alpha (first 32 chars): ${VK_ALPHA:0:32}..."
echo "vk_ic length (bytes): $((${#VK_IC}/2))"

echo ""
echo "=== Initializing verifier ==="
stellar contract invoke \
  --id "$VERIFIER_ID" \
  --source deployer \
  --network testnet \
  -- initialize \
  --vk_alpha "$VK_ALPHA" \
  --vk_beta  "$VK_BETA" \
  --vk_gamma "$VK_GAMMA" \
  --vk_delta "$VK_DELTA" \
  --vk_ic    "$VK_IC"
echo "✓ VK stored on verifier"

echo ""
echo "=== Pointing disbursement contract at verifier ==="
stellar contract invoke \
  --id "$DISBURSEMENT_ID" \
  --source deployer \
  --network testnet \
  -- set_verifier \
  --verifier_address "$VERIFIER_ID"
echo "✓ Disbursement → Groth16 verifier connected"

echo ""
echo "=== Copying zkey to web/public ==="
cp "$ZKEY_SRC" "$ZKEY_DST"
echo "✓ $ZKEY_DST updated ($(du -h "$ZKEY_DST" | cut -f1))"

echo ""
echo "✅  All done!"
echo "   Verifier: $VERIFIER_ID"
echo "   Disbursement: $DISBURSEMENT_ID"
echo "   Next: deploy frontend (vercel deploy / npm run build)"
