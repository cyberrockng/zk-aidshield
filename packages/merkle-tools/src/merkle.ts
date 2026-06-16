/**
 * Merkle tree builder — depth 8, 256 leaf slots.
 * Uses the same Pedersen hash as the Noir circuit so the root
 * computed here matches what the circuit verifies.
 */

import { pedersenHash } from "./hash.js";

export const TREE_DEPTH = 8;
export const TREE_SIZE = 2 ** TREE_DEPTH; // 256 slots

export interface MerkleWitness {
  path: bigint[];       // sibling hashes at each level (length = TREE_DEPTH)
  indices: boolean[];   // false = current is left child, true = right child
}

export interface MerkleTree {
  root: bigint;
  leaves: bigint[];
  // Internal nodes stored level by level: levels[0] = leaves, levels[8] = [root]
  levels: bigint[][];
}

/**
 * Builds a complete Merkle tree from an array of leaves.
 * Pads with zeros up to 256 slots.
 * Returns the root and all intermediate levels for witness generation.
 */
export async function buildMerkleTree(leaves: bigint[]): Promise<MerkleTree> {
  if (leaves.length > TREE_SIZE) {
    throw new Error(`Too many leaves: max ${TREE_SIZE}, got ${leaves.length}`);
  }

  // Pad leaves to full tree size with zeros
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < TREE_SIZE) {
    paddedLeaves.push(0n);
  }

  const levels: bigint[][] = [paddedLeaves];

  // Build each level up to root
  let current = paddedLeaves;
  for (let level = 0; level < TREE_DEPTH; level++) {
    const next: bigint[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const parent = await pedersenHash([current[i], current[i + 1]]);
      next.push(parent);
    }
    levels.push(next);
    current = next;
  }

  return {
    root: current[0],
    leaves: paddedLeaves,
    levels,
  };
}

/**
 * Generates a Merkle membership witness for a leaf at a given index.
 * Returns the sibling path and left/right indices needed by the Noir circuit.
 */
export function getMerkleWitness(tree: MerkleTree, leafIndex: number): MerkleWitness {
  if (leafIndex >= TREE_SIZE) {
    throw new Error(`Leaf index ${leafIndex} out of range (max ${TREE_SIZE - 1})`);
  }

  const path: bigint[] = [];
  const indices: boolean[] = [];

  let idx = leafIndex;
  for (let level = 0; level < TREE_DEPTH; level++) {
    const isRightChild = idx % 2 === 1;
    const siblingIdx = isRightChild ? idx - 1 : idx + 1;
    path.push(tree.levels[level][siblingIdx]);
    indices.push(isRightChild); // true = current is right child
    idx = Math.floor(idx / 2);
  }

  return { path, indices };
}

/**
 * Converts a bigint to a 32-byte hex string (for Soroban BytesN<32>).
 */
export function toHex32(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

/**
 * Converts a bigint to a 0x-prefixed hex string for display.
 */
export function toHexDisplay(n: bigint): string {
  return "0x" + n.toString(16).padStart(64, "0");
}
