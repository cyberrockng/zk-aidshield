/**
 * Beneficiary credential types and client-side verification.
 *
 * The issuer (aid operator) signs a JSON credential binding a secret + Merkle
 * witness to a specific claimant wallet. The signature is Ed25519 via the
 * Stellar SDK (same curve as Stellar accounts).
 *
 * The secret inside the credential NEVER leaves the beneficiary's device — the
 * Groth16 proof is generated in-browser from the credential fields.
 */

export interface BeneficiaryCredential {
  version: '1';
  campaign_id: string;        // hex64 disbursement_id
  claimant_address: string;   // Stellar G... address — must match connected wallet
  slot_index: number;         // leaf index in the Merkle tree
  secret: string;             // hex64 — private claim secret
  leaf_index: number;         // same as slot_index (explicit for prover)
  merkle_path: string[];      // 8 × hex64 sibling hashes
  path_indices: boolean[];    // 8 booleans: false=left, true=right
  issued_at: number;          // unix timestamp (seconds)
  expires_at: number;         // unix timestamp (seconds)
  issuer_public_key: string;  // Stellar G... address of issuing operator
  issuer_signature: string;   // hex128 Ed25519 signature
}

// Public key of the demo issuer (operator).
// Reads from NEXT_PUBLIC_ISSUER_PUBLIC_KEY env var first (Phase 7); falls back to
// the testnet demo key. The matching secret lives only in the server-side API route.
export const ISSUER_PUBLIC_KEY =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ISSUER_PUBLIC_KEY) ||
  'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4';

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
  if (cred.version !== '1') return `Unsupported credential version: ${cred.version}`;

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

  // 6. Signature verification using Stellar SDK Keypair (Ed25519)
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
