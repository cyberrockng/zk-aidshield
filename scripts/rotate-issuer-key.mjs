#!/usr/bin/env node
import { Keypair, StrKey } from '@stellar/stellar-sdk';

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function stellarAddressToField(address) {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error('Invalid Stellar Ed25519 public key');
  }
  const decoded = StrKey.decodeEd25519PublicKey(address);
  const fieldBytes = decoded.subarray(1, 32);
  return bytesToHex(fieldBytes).padStart(64, '0');
}

const issuer = Keypair.random();
const publicKey = issuer.publicKey();
const secret = issuer.secret();
const issuerKeyId = stellarAddressToField(publicKey);

console.log('New ZK AidShield issuer key generated.');
console.log('');
console.log('Keep this secret out of git and chat logs:');
console.log(`ISSUER_SECRET_KEY=${secret}`);
console.log('');
console.log('Public values to configure after regenerating the campaign:');
console.log(`NEXT_PUBLIC_ISSUER_PUBLIC_KEY=${publicKey}`);
console.log(`NEXT_PUBLIC_ISSUER_KEY_ID=${issuerKeyId}`);
console.log('');
console.log('Required rotation steps:');
console.log('1. Store ISSUER_SECRET_KEY only in local .env.local and Vercel environment variables.');
console.log('2. Regenerate packages/merkle-tools/campaign.json with the new issuer public key/key id.');
console.log('3. Deploy/update the campaign Merkle root and add_issuer(new issuer_key_id) on Soroban.');
console.log('4. Revoke the old issuer key id after all old demo credentials are retired.');
console.log('5. Redeploy the frontend with the new NEXT_PUBLIC_ISSUER_PUBLIC_KEY and NEXT_PUBLIC_ISSUER_KEY_ID.');
