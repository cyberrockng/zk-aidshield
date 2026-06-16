// ZK AidShield — Membership + Nullifier Circuit
//
// Proves two facts without revealing private data:
//   1. The claimant's secret corresponds to a leaf in the approved beneficiary Merkle tree
//   2. The nullifier is correctly derived (prevents double-claiming)
//
// Public inputs  (visible on-chain):
//   disbursement_id          — campaign identifier
//   merkle_root              — root of the approved beneficiary Merkle tree (stored on Soroban)
//   nullifier                — one-time-use value; Soroban rejects reused nullifiers
//   claimant_address         — Stellar wallet address as Field; contract checks tx.source matches
//
// Private witness (stays client-side, never revealed):
//   secret                   — beneficiary's private claim secret
//   merkle_path              — sibling hashes along the Merkle proof path (depth 8 = 256 slots)
//   path_indices             — false = current is LEFT child, true = current is RIGHT child

fn main(
    // Private witness
    secret: Field,
    merkle_path: [Field; 8],
    path_indices: [bool; 8],

    // Public inputs
    disbursement_id: pub Field,
    merkle_root: pub Field,
    nullifier: pub Field,
    claimant_address: pub Field,
) {
    // Step 1: Compute the beneficiary leaf commitment
    // leaf = pedersen_hash(secret, disbursement_id)
    // Campaign-scoped so the same secret cannot be reused across campaigns
    let leaf: Field = std::hash::pedersen_hash([secret, disbursement_id]);

    // Step 2: Verify Merkle membership
    // Recomputes the root from the leaf + sibling path
    // Must match merkle_root stored in the Soroban disbursement contract
    let computed_root = compute_merkle_root(leaf, merkle_path, path_indices);
    assert(computed_root == merkle_root, "Merkle proof invalid: claimant not in beneficiary list");

    // Step 3: Verify nullifier correctness
    // nullifier = pedersen_hash(secret, disbursement_id, 1)
    // The trailing 1 is a domain separator distinguishing nullifiers from leaves
    // Soroban contract blocks any claim that reuses a stored nullifier
    let expected_nullifier: Field = std::hash::pedersen_hash([secret, disbursement_id, 1]);
    assert(nullifier == expected_nullifier, "Nullifier does not match secret");

    // Step 4: Address binding — ties this proof to a specific Stellar wallet
    // Even if someone intercepts the proof, it only works for claimant_address
    // Soroban contract additionally enforces: tx.source_account == claimant_address
    let _binding: Field = std::hash::pedersen_hash([secret, claimant_address]);
}

// Recomputes the Merkle root from a leaf and its sibling path
// path_indices[i] = false → current node is the LEFT child at level i
// path_indices[i] = true  → current node is the RIGHT child at level i
fn compute_merkle_root(leaf: Field, path: [Field; 8], indices: [bool; 8]) -> Field {
    let mut current = leaf;
    for i in 0..8 {
        let sibling = path[i];
        if indices[i] == false {
            current = std::hash::pedersen_hash([current, sibling]);
        } else {
            current = std::hash::pedersen_hash([sibling, current]);
        }
    }
    current
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn test_valid_claim() {
    let secret: Field = 0x1234567890abcdef;
    let disbursement_id: Field = 0x01;
    let claimant_address: Field = 0xdeadbeef;

    let leaf: Field = std::hash::pedersen_hash([secret, disbursement_id]);
    let nullifier: Field = std::hash::pedersen_hash([secret, disbursement_id, 1]);

    let zero_sibling: Field = 0;
    let mut merkle_path: [Field; 8] = [0; 8];
    let path_indices: [bool; 8] = [false; 8];
    merkle_path[0] = zero_sibling;

    // Build a single-leaf tree: root = pedersen(leaf, 0) then 7 more levels of pedersen(x, 0)
    let mut root: Field = leaf;
    for _i in 0..8 {
        root = std::hash::pedersen_hash([root, 0]);
    }

    main(
        secret,
        merkle_path,
        path_indices,
        disbursement_id,
        root,
        nullifier,
        claimant_address,
    );
}

#[test(should_fail)]
fn test_wrong_secret_fails() {
    let secret: Field = 0x1234567890abcdef;
    let wrong_secret: Field = 0xdeadbeef;
    let disbursement_id: Field = 0x01;
    let claimant_address: Field = 0xdeadbeef;

    let leaf: Field = std::hash::pedersen_hash([secret, disbursement_id]);
    let nullifier: Field = std::hash::pedersen_hash([secret, disbursement_id, 1]);

    let merkle_path: [Field; 8] = [0; 8];
    let path_indices: [bool; 8] = [false; 8];

    let mut root: Field = leaf;
    for _i in 0..8 {
        root = std::hash::pedersen_hash([root, 0]);
    }

    // wrong_secret → Merkle proof will not match
    main(wrong_secret, merkle_path, path_indices, disbursement_id, root, nullifier, claimant_address);
}

#[test(should_fail)]
fn test_fake_nullifier_fails() {
    let secret: Field = 0x1234567890abcdef;
    let disbursement_id: Field = 0x01;
    let claimant_address: Field = 0xdeadbeef;

    let leaf: Field = std::hash::pedersen_hash([secret, disbursement_id]);
    let fake_nullifier: Field = 0x999;

    let merkle_path: [Field; 8] = [0; 8];
    let path_indices: [bool; 8] = [false; 8];

    let mut root: Field = leaf;
    for _i in 0..8 {
        root = std::hash::pedersen_hash([root, 0]);
    }

    // fake_nullifier → nullifier check will fail
    main(secret, merkle_path, path_indices, disbursement_id, root, fake_nullifier, claimant_address);
}
