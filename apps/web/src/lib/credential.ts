/**
 * Beneficiary credential types and client-side verification.
 *
 * The issuer (aid operator) signs a JSON credential binding a secret + Merkle
 * witness to a specific claimant wallet. The signature is Ed25519 via the
 * Stellar SDK (same curve as Stellar accounts).
 *
 * The issuer delivers a signed credential containing the secret and Merkle
 * witness. During claim, Groth16 proof generation runs in the beneficiary
 * browser, and the secret/witness are not sent on-chain or to the verifier.
 */

export interface BeneficiaryCredential {
  version: '2';
  campaign_id: string;        // hex64 disbursement_id
  claimant_address: string;   // Stellar G... address — must match connected wallet
  slot_index: number;         // leaf index in the Merkle tree
  secret: string;             // hex64 — private claim secret
  leaf_index: number;         // same as slot_index (explicit for prover)
  merkle_path: string[];      // 8 × hex64 sibling hashes
  path_indices: boolean[];    // 8 booleans: false=left, true=right
  issued_at: number;          // unix timestamp (seconds)
  expires_at: number;         // unix timestamp (seconds)
  issuer_key_id: string;      // hex64 field element registered on-chain
  issuer_public_key: string;  // Stellar G... address of issuing operator
  issuer_signature: string;   // hex128 Ed25519 signature
}

import { ISSUER_KEY_ID, ISSUER_PUBLIC_KEY, stellarAddressToField } from './constants';

export { ISSUER_KEY_ID, ISSUER_PUBLIC_KEY };

/**
 * Compute the signing payload for a credential (excludes the signature field).
 * Fields are sorted lexicographically so the payload is deterministic.
 */
export function credentialSigningPayload(cred: Omit<BeneficiaryCredential, 'issuer_signature'>): string {
  const keys = Object.keys(cred).sort() as Array<keyof typeof cred>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ordered: Record<string, any> = {};
  for (const k of keys) ordered[k] = cred[k];
  return JSON.stringify(ordered);
}

/**
 * Verify the issuer signature on a credential in the browser.
 * Returns null on success, or an error string describing the failure.
 */
export async function verifyCredential(
  cred: BeneficiaryCredential,
  connectedWallet: string,
): Promise<string | null> {
  // 1. Version check
  if (cred.version !== '2') return `Unsupported credential version: ${cred.version}`;

  // 2. Wallet binding
  if (cred.claimant_address !== connectedWallet) {
    return `Credential issued to ${cred.claimant_address.slice(0, 8)}… but your wallet is ${connectedWallet.slice(0, 8)}…`;
  }

  // 3. Expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > cred.expires_at) {
    const d = new Date(cred.expires_at * 1000).toLocaleDateString();
    return `Credential expired on ${d}`;
  }

  // 4. Issuer key
  if (cred.issuer_public_key !== ISSUER_PUBLIC_KEY) {
    return `Unknown issuer public key: ${cred.issuer_public_key.slice(0, 10)}…`;
  }

  // 5. Field counts
  if (cred.merkle_path.length !== 8 || cred.path_indices.length !== 8) {
    return 'merkle_path and path_indices must each have 8 elements';
  }

  // 6. Hex field shape checks
  if (!isHex32(cred.campaign_id)) return 'campaign_id must be a 32-byte hex field element';
  if (!isHex32(cred.secret)) return 'secret must be a 32-byte hex field element';
  if (!cred.merkle_path.every(isHex32)) return 'merkle_path entries must be 32-byte hex field elements';
  if (!cred.path_indices.every((v) => typeof v === 'boolean')) return 'path_indices entries must be booleans';
  if (!Number.isInteger(cred.slot_index) || cred.slot_index < 0) return 'slot_index must be a non-negative integer';
  if (!Number.isInteger(cred.leaf_index) || cred.leaf_index < 0) return 'leaf_index must be a non-negative integer';
  if (!Number.isInteger(cred.issued_at) || !Number.isInteger(cred.expires_at)) return 'issued_at and expires_at must be integer unix timestamps';
  if (!/^[0-9a-fA-F]{128}$/.test(cred.issuer_signature)) return 'issuer_signature must be a 64-byte hex Ed25519 signature';

  // 7. On-chain issuer key id
  if (!/^[0-9a-fA-F]{64}$/.test(cred.issuer_key_id)) {
    return 'issuer_key_id must be a 32-byte hex field element';
  }
  if (cred.issuer_key_id !== ISSUER_KEY_ID || cred.issuer_key_id !== stellarAddressToField(cred.issuer_public_key)) {
    return 'Credential issuer key id does not match the configured issuer';
  }

  // 8. Signature verification using Stellar SDK Keypair (Ed25519)
  try {
    const { Keypair } = await import('@stellar/stellar-sdk');
    const { issuer_signature, ...rest } = cred;
    const payload = credentialSigningPayload(rest);
    const msgBuffer = new TextEncoder().encode(payload);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    // Buffer is polyfilled by webpack in the browser (used by stellar-sdk)
    const hashBytes = Buffer.from(hashBuffer);
    const sigBytes = Buffer.from(hexToBytes(issuer_signature));
    const issuerKP = Keypair.fromPublicKey(cred.issuer_public_key);
    const valid = issuerKP.verify(hashBytes, sigBytes);
    if (!valid) return 'Invalid issuer signature — credential may have been tampered with';
  } catch (e) {
    return `Signature verification failed: ${String(e)}`;
  }

  return null; // all checks passed
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

function isHex32(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value);
}
