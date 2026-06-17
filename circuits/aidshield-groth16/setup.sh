#!/usr/bin/env bash
# Trusted setup + circuit compilation for AidShield Groth16 (BLS12-381)
# Run once after installing circom: bash setup.sh
set -e

export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$HOME/.local/bin:$PATH"
SNARKJS="node node_modules/.bin/snarkjs"

echo "=== Step 1: Compile circuit ==="
circom circuit.circom --r1cs --wasm --sym --curve BLS12381 -o build/
echo "Constraints: $(grep 'non-linear constraints' build/circuit.r1cs.stats 2>/dev/null || echo 'see build/')"

echo ""
echo "=== Step 2: Download Powers of Tau (BLS12-381, 2^16) ==="
if [ ! -f pot16_bls12381_final.ptau ]; then
  # BLS12-381 ptau file — enough for ~65k constraints
  curl -L https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau \
    -o pot16_bls12381_final.ptau 2>/dev/null || \
  $SNARKJS powersoftau new bls12-381 16 pot16_new.ptau -v 2>&1 | tail -3 && \
  $SNARKJS powersoftau prepare phase2 pot16_new.ptau pot16_bls12381_final.ptau -v 2>&1 | tail -3
fi

echo ""
echo "=== Step 3: Groth16 setup ==="
mkdir -p build
$SNARKJS groth16 setup build/circuit.r1cs pot16_bls12381_final.ptau build/circuit_0000.zkey -v 2>&1 | tail -5

echo ""
echo "=== Step 4: Contribute randomness (non-interactive, demo only) ==="
echo "aidshield_contribution_$(date +%s)" | \
  $SNARKJS zkey contribute build/circuit_0000.zkey build/circuit_final.zkey \
  --name="AidShield Demo" -v 2>&1 | tail -3

echo ""
echo "=== Step 5: Export verification key ==="
$SNARKJS zkey export verificationkey build/circuit_final.zkey build/verification_key.json
echo "Verification key written to build/verification_key.json"

echo ""
echo "=== Step 6: Export Solidity verifier (for reference) ==="
$SNARKJS zkey export solidityverifier build/circuit_final.zkey build/Verifier.sol

echo ""
echo "=== Done! ==="
echo "Artifacts:"
echo "  build/circuit.wasm           <- used by browser prover"
echo "  build/circuit_final.zkey     <- proving key"
echo "  build/verification_key.json  <- verification key -> Soroban contract"
ls -lh build/
