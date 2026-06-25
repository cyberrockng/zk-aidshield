import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { computeNullifier, stellarAddressToFieldBigint } from '../packages/merkle-tools/src/hash.ts';
import snarkjs from '../circuits/aidshield-groth16/node_modules/snarkjs/build/main.cjs';

const root = process.cwd();
const circuitDir = join(root, 'circuits', 'aidshield-groth16');
const wasmPath = join(circuitDir, 'build', 'circuit_js', 'circuit.wasm');
const zkeyPath = join(circuitDir, 'build', 'circuit_final.zkey');
const vkeyPath = join(circuitDir, 'build', 'verification_key.json');
const campaignPath = join(root, 'packages', 'merkle-tools', 'campaign.json');

function hexToDecimal(hex) {
  return BigInt(`0x${hex}`).toString();
}

for (const file of [wasmPath, zkeyPath, vkeyPath]) {
  if (!existsSync(file)) throw new Error(`Missing proof artifact: ${file}`);
}

if (!existsSync(campaignPath)) {
  console.log('No local campaign.json found. Generate one with packages/merkle-tools before running this proof check.');
  process.exit(0);
}

const campaign = JSON.parse(readFileSync(campaignPath, 'utf8'));
const claim = campaign.claims?.[0];
if (!claim) throw new Error('campaign.json has no claim fixture');
const claimantField = stellarAddressToFieldBigint(claim.claimant_address);
const nullifier = await computeNullifier(
  BigInt(`0x${claim.secret}`),
  BigInt(`0x${campaign.disbursement_id}`),
  claimantField,
);

const input = {
  secret: hexToDecimal(claim.secret),
  path_elements: claim.merkle_path.map(hexToDecimal),
  path_indices: claim.path_indices.map((value) => (value ? '1' : '0')),
  disbursement_id: hexToDecimal(campaign.disbursement_id),
  merkle_root: hexToDecimal(campaign.merkle_root),
  nullifier: nullifier.toString(),
  claimant_address: claimantField.toString(),
  expires_at: String(claim.expires_at ?? campaign.expires_at),
  issuer_key_id: hexToDecimal(claim.issuer_key_id ?? campaign.issuer_key_id),
};

const vkeyRaw = readFileSync(vkeyPath, 'utf8');
const vkey = JSON.parse(vkeyRaw);
const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
const ok = await snarkjs.groth16.verify(vkey, publicSignals, proof);
const vkHash = createHash('sha256').update(vkeyRaw).digest('hex');

if (!ok) throw new Error('Known local proof fixture failed verification');

console.log('Known local proof fixture verified successfully.');
console.log(`public_signals: ${publicSignals.length}`);
console.log(`verification_key_sha256: ${vkHash}`);
console.log('Private witness values were not printed.');
process.exit(0);
