# AidShield Disbursement Contract

Soroban smart contract for the ZK AidShield aid disbursement system.

## Deployed (Stellar Testnet)

`CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2`

## What It Does

Manages a ZK-gated aid campaign on Stellar:

- **`initialize`** — admin sets campaign params: disbursement_id, Merkle root, payout amount, XLM SAC address, verifier contract address
- **`fund`** — deposits real XLM into the escrow via the native Stellar Asset Contract
- **`claim`** — beneficiary submits a 384-byte Groth16 proof; contract cross-calls the verifier, checks disbursement_id + merkle_root, enforces nullifier uniqueness, then releases XLM
- **`stats`** — returns live campaign stats; escrow balance is read directly from the SAC
- **`is_nullifier_used`** — replay-protection check (public read)
- **`update_root`** — admin can rotate the Merkle root for a new beneficiary list

## Key Design Decisions

**Real XLM, not counters.** `fund()` calls `token::Client.transfer(funder → contract)` and `claim()` calls `token::Client.transfer(contract → claimant)` via the native XLM SAC. The `stats()` escrow balance is a live on-chain balance query.

**Cross-contract verification.** `claim()` calls `AidShieldVerifier.verify(proof, pi)` before any state changes. A failing verifier panics the entire transaction — no partial state updates.

**TTL extension.** `initialize()` calls `env.storage().instance().extend_ttl(518_400, 518_400)` (~30 days at 5 s/ledger). Each successful `claim()` refreshes both the instance storage TTL and the individual nullifier entry's persistent TTL, preventing archival of live campaigns.

**Event emission.** `claim()` emits a `claim.paid` event (disbursement_id, nullifier, claimant, amount). `update_root()` emits a `root.updated` event (old_root, new_root) so auditors can track beneficiary list rotations.

**Address field encoding.** The circom circuit's `claimant_address` public input is a BLS12-381 field element (31 bytes of the Ed25519 public key, zero-padded to 32 bytes). `ProofPublicInputs.claimant_address_field` carries this value; `claimant.require_auth()` enforces the wallet signature.

## Building and Testing

```bash
# Run tests: fund, claim, replay, wrong root, bad proof, SAC balance, pause, address binding
cargo test

# Build WASM
cargo build --target wasm32v1-none --release
```

## Deploying

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/aidshield.wasm \
  --source <identity> \
  --network testnet

stellar contract invoke --id <CONTRACT_ID> --source <identity> --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --disbursement_id <32-byte-hex> \
  --merkle_root <32-byte-hex> \
  --payout_amount 10000000 \
  --token_address CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --verifier_address <VERIFIER_CONTRACT_ID>
```
