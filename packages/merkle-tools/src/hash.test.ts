import { computeLeaf, computeNullifier, stellarAddressToFieldBigint } from './hash.ts';
import { buildMerkleTree, getMerkleWitness } from './merkle.ts';

let passed = 0;
let failed = 0;

function ok(label: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}`); failed++; }
}

async function main() {
  console.log('merkle-tools hash tests');

  // stellarAddressToFieldBigint
  const addr = 'GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ';
  const field = stellarAddressToFieldBigint(addr);
  ok('stellarAddressToFieldBigint returns bigint', typeof field === 'bigint');
  ok('field is 248-bit (≤ 2^248)', field < (1n << 248n));
  ok('field is non-zero', field > 0n);
  ok('same address gives same field (deterministic)', stellarAddressToFieldBigint(addr) === field);

  const addr2 = 'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4';
  ok('different addresses give different fields', stellarAddressToFieldBigint(addr2) !== field);

  // computeLeaf and computeNullifier
  const secret = 0xdeadbeef1234n;
  const disbId = 1n;
  const addrField = field;

  const leaf = await computeLeaf(secret, disbId, addrField);
  ok('leaf is bigint', typeof leaf === 'bigint');
  ok('leaf is non-zero', leaf > 0n);
  ok('leaf is deterministic', (await computeLeaf(secret, disbId, addrField)) === leaf);

  const leaf2 = await computeLeaf(secret + 1n, disbId, addrField);
  ok('different secret → different leaf', leaf2 !== leaf);

  const leaf3 = await computeLeaf(secret, disbId, stellarAddressToFieldBigint(addr2));
  ok('different wallet → different leaf', leaf3 !== leaf);

  const nullifier = await computeNullifier(secret, disbId, addrField);
  ok('nullifier is bigint', typeof nullifier === 'bigint');
  ok('nullifier differs from leaf', nullifier !== leaf);
  ok('nullifier is deterministic', (await computeNullifier(secret, disbId, addrField)) === nullifier);

  // buildMerkleTree + getMerkleWitness
  const leaves = [leaf, leaf2, leaf3];
  const tree = await buildMerkleTree(leaves);
  ok('root is bigint', typeof tree.root === 'bigint');
  ok('root is non-zero', tree.root > 0n);
  ok('tree has 256 padded leaves', tree.leaves.length === 256);
  ok('root is deterministic', (await buildMerkleTree(leaves)).root === tree.root);

  const witness = getMerkleWitness(tree, 0);
  ok('witness has 8 path elements', witness.path.length === 8);
  ok('witness has 8 path indices', witness.indices.length === 8);

  const differentLeaves = [leaf2, leaf, leaf3];
  ok('different leaf order → different root', (await buildMerkleTree(differentLeaves)).root !== tree.root);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
