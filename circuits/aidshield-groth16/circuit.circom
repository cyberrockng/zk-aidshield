pragma circom 2.1.6;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/switcher.circom";

// Merkle tree inclusion proof at depth 8 (256 slots)
// Uses Poseidon hash — same as the off-circuit merkle-tools implementation
template MerkleProof(depth) {
    signal input leaf;
    signal input path_elements[depth];
    signal input path_indices[depth];  // 0 = leaf is left child, 1 = leaf is right child
    signal output root;

    component hashers[depth];
    component switchers[depth];

    for (var i = 0; i < depth; i++) {
        switchers[i] = Switcher();
        switchers[i].sel <== path_indices[i];
        switchers[i].L   <== i == 0 ? leaf : hashers[i-1].out;
        switchers[i].R   <== path_elements[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== switchers[i].outL;
        hashers[i].inputs[1] <== switchers[i].outR;
    }

    root <== hashers[depth - 1].out;
}

// ZK AidShield — Membership + Nullifier (Groth16 / BLS12-381)
//
// Private inputs:
//   secret           — beneficiary's claim secret (Field)
//   path_elements[8] — Merkle sibling hashes
//   path_indices[8]  — 0 = left child, 1 = right child
//
// Public inputs:
//   disbursement_id  — campaign identifier
//   merkle_root      — root stored on Soroban
//   nullifier        — one-time claim token (address-bound)
//   claimant_address — Ed25519 key field encoding; Soroban checks tx signer matches
template AidShieldMembership(depth) {
    // Private
    signal input secret;
    signal input path_elements[depth];
    signal input path_indices[depth];

    // Public
    signal input disbursement_id;
    signal input merkle_root;
    signal input nullifier;
    signal input claimant_address;

    // Step 1: leaf = Poseidon(secret, disbursement_id)
    component leafHasher = Poseidon(2);
    leafHasher.inputs[0] <== secret;
    leafHasher.inputs[1] <== disbursement_id;

    // Step 2: Merkle membership proof
    component tree = MerkleProof(depth);
    tree.leaf <== leafHasher.out;
    for (var i = 0; i < depth; i++) {
        tree.path_elements[i] <== path_elements[i];
        tree.path_indices[i]  <== path_indices[i];
    }
    tree.root === merkle_root;

    // Step 3: Nullifier = Poseidon(secret, disbursement_id, claimant_address, 1)
    //   including claimant_address binds the nullifier to one wallet —
    //   a stolen proof cannot be replayed from a different address.
    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== secret;
    nullifierHasher.inputs[1] <== disbursement_id;
    nullifierHasher.inputs[2] <== claimant_address;
    nullifierHasher.inputs[3] <== 1;
    nullifierHasher.out === nullifier;
}

component main { public [disbursement_id, merkle_root, nullifier, claimant_address] }
    = AidShieldMembership(8);
