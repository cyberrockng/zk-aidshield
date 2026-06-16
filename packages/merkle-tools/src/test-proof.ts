import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { readFileSync } from 'fs';

const circuit = JSON.parse(
  readFileSync(
    '../../circuits/aidshield-membership/target/aidshield_membership.json',
    'utf-8',
  ),
);

const campaign = JSON.parse(readFileSync('campaign.json', 'utf-8'));
const claim = campaign.claims[0];

const inputs = {
  secret: `0x${claim.secret}`,
  merkle_path: claim.merkle_path.map((h: string) => `0x${h}`),
  path_indices: claim.path_indices,
  disbursement_id: `0x${campaign.disbursement_id}`,
  merkle_root: `0x${campaign.merkle_root}`,
  nullifier: `0x${claim.nullifier}`,
  claimant_address: '0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
};

console.log('Initialising Barretenberg...');
const api = await Barretenberg.new({ threads: 4 });
const backend = new UltraHonkBackend(circuit.bytecode, api);
const noir = new Noir(circuit);

console.log('Executing circuit (generating witness)...');
const { witness } = await noir.execute(inputs);
console.log('Witness size:', witness.length, 'bytes');

console.log('Generating UltraHonk proof (may take 30-60s)...');
const start = Date.now();
const { proof, publicInputs } = await backend.generateProof(witness);
console.log(`Proof generated in ${((Date.now() - start) / 1000).toFixed(1)}s`);
console.log('Proof size:', proof.length, 'bytes');
console.log('Public inputs:', publicInputs.length);
console.log('Proof (first 32 bytes):', Buffer.from(proof.slice(0, 32)).toString('hex'));

console.log('\nVerifying proof...');
const valid = await backend.verifyProof({ proof, publicInputs });
console.log('Proof valid:', valid);

await api.destroy();
