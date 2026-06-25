import { computeLeaf, computeNullifier, stellarAddressToFieldBigint } from './hash.js';
import { buildMerkleTree, getMerkleWitness } from './merkle.js';

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
  ok(
    'stellarAddressToFieldBigint matches fixture',
    field.toString(16).padStart(64, '0') ===
      '00747b9622464715c3fc3dd950557a7498f735ad42dd43bcee60df34a21c34ea',
  );

  const addr2 = 'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4';
  ok('different addresses give different fields', stellarAddressToFieldBigint(addr2) !== field);

  // computeLeaf and computeNullifier
  const secret = 0xdeadbeef1234n;
  const disbId = 1n;
  const addrField = field;
  const expiresAt = 2_000_000_000n;
  const issuerKeyId = stellarAddressToFieldBigint(addr2);

  const leaf = await computeLeaf(secret, disbId, addrField, expiresAt, issuerKeyId);
  ok('leaf is bigint', typeof leaf === 'bigint');
  ok('leaf is non-zero', leaf > 0n);
  ok('leaf is deterministic', (await computeLeaf(secret, disbId, addrField, expiresAt, issuerKeyId)) === leaf);
  ok(
    'leaf matches fixture',
    leaf.toString(16).padStart(64, '0') ===
      '59bbfb4bb24bb8f6cc890b414559f6a33f7f19bf96e04abe8678d008c3c60432',
  );

  const leaf2 = await computeLeaf(secret + 1n, disbId, addrField, expiresAt, issuerKeyId);
  ok('different secret → different leaf', leaf2 !== leaf);

  const leaf3 = await computeLeaf(secret, disbId, stellarAddressToFieldBigint(addr2), expiresAt, issuerKeyId);
  ok('different wallet → different leaf', leaf3 !== leaf);

  const leaf4 = await computeLeaf(secret, disbId, addrField, expiresAt + 1n, issuerKeyId);
  ok('different expiry → different leaf', leaf4 !== leaf);

  const leaf5 = await computeLeaf(secret, disbId, addrField, expiresAt, issuerKeyId + 1n);
  ok('different issuer → different leaf', leaf5 !== leaf);

  const nullifier = await computeNullifier(secret, disbId, addrField);
  ok('nullifier is bigint', typeof nullifier === 'bigint');
  ok('nullifier differs from leaf', nullifier !== leaf);
  ok('nullifier is deterministic', (await computeNullifier(secret, disbId, addrField)) === nullifier);
  ok(
    'nullifier matches fixture',
    nullifier.toString(16).padStart(64, '0') ===
      '36bc1411d16e3c56976a92e9797abee286f81db19c72e6a94a9c50efd6518900',
  );

  // buildMerkleTree + getMerkleWitness
  const leaves = [leaf, leaf2, leaf3];
  const tree = await buildMerkleTree(leaves);
  ok('root is bigint', typeof tree.root === 'bigint');
  ok('root is non-zero', tree.root > 0n);
  ok('tree has 256 padded leaves', tree.leaves.length === 256);
  ok('root is deterministic', (await buildMerkleTree(leaves)).root === tree.root);
  ok(
    'root matches fixture',
    tree.root.toString(16).padStart(64, '0') ===
      '3758f231b89ee0c2915d9c98fd8e9f7fb7dfe2f873e03e3d1234189bb4a1a56d',
  );

  const witness = getMerkleWitness(tree, 0);
  ok('witness has 8 path elements', witness.path.length === 8);
  ok('witness has 8 path indices', witness.indices.length === 8);

  const differentLeaves = [leaf2, leaf, leaf3];
  ok('different leaf order → different root', (await buildMerkleTree(differentLeaves)).root !== tree.root);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
