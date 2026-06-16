/**
 * Merkle tree tests — verifies that:
 * 1. Root is consistent across tree builds
 * 2. Witness paths verify correctly against the root
 * 3. Different secrets produce different leaves
 * 4. Nullifiers are derived correctly
 */

import { computeLeaf, computeNullifier, cleanup } from "./hash.js";
import { buildMerkleTree, getMerkleWitness, TREE_DEPTH } from "./merkle.js";

async function pedersenHashPairLocal(a: bigint, b: bigint): Promise<bigint> {
  const { pedersenHash } = await import("./hash.js");
  return pedersenHash([a, b]);
}

async function verifyWitness(
  leaf: bigint,
  path: bigint[],
  indices: boolean[],
  expectedRoot: bigint
): Promise<boolean> {
  let current = leaf;
  for (let i = 0; i < TREE_DEPTH; i++) {
    const sibling = path[i];
    if (!indices[i]) {
      current = await pedersenHashPairLocal(current, sibling);
    } else {
      current = await pedersenHashPairLocal(sibling, current);
    }
  }
  return current === expectedRoot;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  ✅ ${message}`);
}

async function runTests() {
  console.log("🧪 Running Merkle tree tests...\n");

  const disbId = 1n;

  // ── Test 1: Root is deterministic ──────────────────────────────────────────
  console.log("Test 1: Root is deterministic");
  const secret1 = 0x1234567890abcdefn;
  const leaf1 = await computeLeaf(secret1, disbId);
  const tree1 = await buildMerkleTree([leaf1]);
  const tree2 = await buildMerkleTree([leaf1]);
  assert(tree1.root === tree2.root, "Same leaves produce same root");

  // ── Test 2: Witness verifies against root ─────────────────────────────────
  console.log("\nTest 2: Witness verifies against root");
  const secret2 = 0xdeadbeefcafebaben;
  const secret3 = 0x0102030405060708n;
  const leaf2 = await computeLeaf(secret2, disbId);
  const leaf3 = await computeLeaf(secret3, disbId);
  const tree3 = await buildMerkleTree([leaf1, leaf2, leaf3]);

  for (let i = 0; i < 3; i++) {
    const witness = getMerkleWitness(tree3, i);
    const leaves = [leaf1, leaf2, leaf3];
    const valid = await verifyWitness(leaves[i], witness.path, witness.indices, tree3.root);
    assert(valid, `Witness for leaf ${i} verifies against root`);
  }

  // ── Test 3: Wrong leaf fails witness verification ─────────────────────────
  console.log("\nTest 3: Wrong leaf fails witness verification");
  const fakeLeaf = 0x999n;
  const witness0 = getMerkleWitness(tree3, 0);
  const invalidResult = await verifyWitness(fakeLeaf, witness0.path, witness0.indices, tree3.root);
  assert(!invalidResult, "Wrong leaf does not verify against root");

  // ── Test 4: Different secrets produce different leaves ────────────────────
  console.log("\nTest 4: Different secrets produce different leaves");
  const leafA = await computeLeaf(0xaaaan, disbId);
  const leafB = await computeLeaf(0xbbbn, disbId);
  assert(leafA !== leafB, "Different secrets produce different leaves");

  // ── Test 5: Same secret + different campaign = different leaf ─────────────
  console.log("\nTest 5: Campaign domain separation");
  const leafCamp1 = await computeLeaf(secret1, 1n);
  const leafCamp2 = await computeLeaf(secret1, 2n);
  assert(leafCamp1 !== leafCamp2, "Same secret, different campaigns → different leaves");

  // ── Test 6: Nullifier != leaf (domain separator works) ───────────────────
  console.log("\nTest 6: Nullifier != leaf");
  const nullifier = await computeNullifier(secret1, disbId);
  assert(nullifier !== leaf1, "Nullifier is distinct from leaf");

  // ── Test 7: Nullifier is deterministic ───────────────────────────────────
  console.log("\nTest 7: Nullifier is deterministic");
  const null1 = await computeNullifier(secret1, disbId);
  const null2 = await computeNullifier(secret1, disbId);
  assert(null1 === null2, "Same inputs produce same nullifier");

  console.log("\n🎉 All tests passed!\n");
  await cleanup();
}

runTests().catch((e) => {
  console.error("Test error:", e);
  process.exit(1);
});
