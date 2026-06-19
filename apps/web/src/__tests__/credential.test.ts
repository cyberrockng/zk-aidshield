/**
 * Unit tests for credential.ts — verifyCredential()
 *
 * Covers: valid credential, wrong wallet, expired, wrong issuer key,
 * tampered signature, malformed path, version mismatch.
 *
 * All tests run in Node.js (vitest); crypto.subtle is available globally in Node 20+.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import {
  verifyCredential,
  credentialSigningPayload,
  ISSUER_PUBLIC_KEY,
  ISSUER_KEY_ID,
  type BeneficiaryCredential,
} from '../lib/credential';
import {
  CREDENTIAL_QR_PREFIX,
  ENCRYPTED_CREDENTIAL_QR_PREFIX,
  decodeCredentialQr,
  encodeCredentialQr,
  encodeEncryptedCredentialQr,
  prettyCredentialJson,
} from '../lib/credential-qr';

// ── Demo issuer keypair (matches constants in credential.ts / API route) ──────
const ISSUER_SECRET = 'SBMF2UKOVBCU5XG24BBQMCXF4QFGNUHMBMHH6HQO4NEMF6MKTDWN5XKU';
const WALLET_A = 'GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ';
const WALLET_B = 'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sign(payload: string): string {
  const msgHash = createHash('sha256').update(payload).digest();
  const kp = Keypair.fromSecret(ISSUER_SECRET);
  return Buffer.from(kp.sign(msgHash)).toString('hex');
}

function makeCred(overrides: Partial<BeneficiaryCredential> = {}): BeneficiaryCredential {
  const now = Math.floor(Date.now() / 1000);
  const base: Omit<BeneficiaryCredential, 'issuer_signature'> = {
    version: '2',
    campaign_id: '0000000000000000000000000000000000000000000000000000000000000001',
    claimant_address: WALLET_A,
    slot_index: 0,
    secret: '00132a8a297936680482cfc611605283081a0af5104b25ca73ddcbdb540150d3',
    leaf_index: 0,
    merkle_path: [
      '0000000000000000000000000000000000000000000000000000000000000000',
      '6c2bac92f1ffd53ea9c3166480d221f6d8b716ce67ba22b751781cbd305bfc7b',
      '6c5c43bd280a41f3cf052601f5f04681f4a46f494248244fb9f02ba0fc13e992',
      '23b5902987a2e16f5f65cfd3aca7ab9fd30a96f0201108eee6a840a7a0c6b1dc',
      '0fe5437fa39d3f737bd90712346070b2b2f6efd41048089c757ca5bce82cdd0e',
      '68d1bdb26377ba3e11cb6bbb313eb167366ce22f9c4a8a16a92849c51da4d0b3',
      '4b793aba5e3621207b614ff7185da64d7558ce4d5406eae21d6aa8ae5035c10a',
      '0e5da84a34c506465ddd6842d1a4de891224981c142bac69cdb6c8f3fddaae8f',
    ],
    path_indices: [false, false, false, false, false, false, false, false],
    issued_at: now - 60,
    expires_at: now + 30 * 24 * 3600,
    issuer_key_id: ISSUER_KEY_ID,
    issuer_public_key: ISSUER_PUBLIC_KEY,
    ...overrides,
  };
  // Remove issuer_signature from overrides before signing (if accidentally included)
  const { issuer_signature: _drop, ...cleanBase } = { ...base, issuer_signature: '' };
  const payload = credentialSigningPayload(cleanBase as Omit<BeneficiaryCredential, 'issuer_signature'>);
  const issuer_signature = sign(payload);
  return { ...base, issuer_signature, ...overrides } as BeneficiaryCredential;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('verifyCredential', () => {
  it('accepts a valid credential for the correct wallet', async () => {
    const cred = makeCred();
    const err = await verifyCredential(cred, WALLET_A);
    expect(err).toBeNull();
  });

  it('rejects when claimant_address does not match the connected wallet', async () => {
    const cred = makeCred(); // signed for WALLET_A
    const err = await verifyCredential(cred, WALLET_B);
    expect(err).not.toBeNull();
    expect(err).toMatch(/wallet/i);
  });

  it('rejects an expired credential', async () => {
    const past = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const cred = makeCred({ expires_at: past });
    const err = await verifyCredential(cred, WALLET_A);
    expect(err).not.toBeNull();
    expect(err).toMatch(/expir/i);
  });

  it('rejects a tampered signature (flip one hex char)', async () => {
    const cred = makeCred();
    const tampered = cred.issuer_signature.slice(0, -2) + (cred.issuer_signature.endsWith('ff') ? '00' : 'ff');
    const err = await verifyCredential({ ...cred, issuer_signature: tampered }, WALLET_A);
    expect(err).not.toBeNull();
    expect(err).toMatch(/signature|tamper/i);
  });

  it('rejects when a merkle_path field is altered after signing', async () => {
    const cred = makeCred();
    const badPath = [...cred.merkle_path];
    badPath[0] = 'aaaa' + badPath[0].slice(4); // tamper first sibling
    const err = await verifyCredential({ ...cred, merkle_path: badPath }, WALLET_A);
    expect(err).not.toBeNull();
    expect(err).toMatch(/signature|tamper/i);
  });

  it('rejects an unknown issuer public key', async () => {
    const otherKP = Keypair.random();
    // Build a cred signed by a different key
    const base: Omit<BeneficiaryCredential, 'issuer_signature'> = {
      version: '2',
      campaign_id: '0000000000000000000000000000000000000000000000000000000000000001',
      claimant_address: WALLET_A,
      slot_index: 0,
      secret: '00132a8a297936680482cfc611605283081a0af5104b25ca73ddcbdb540150d3',
      leaf_index: 0,
      merkle_path: Array(8).fill('0000000000000000000000000000000000000000000000000000000000000000'),
      path_indices: Array(8).fill(false),
      issued_at: Math.floor(Date.now() / 1000) - 60,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      issuer_key_id: '0000000000000000000000000000000000000000000000000000000000000001',
      issuer_public_key: otherKP.publicKey(),
    };
    const payload = credentialSigningPayload(base);
    const msgHash = createHash('sha256').update(payload).digest();
    const sig = Buffer.from(otherKP.sign(msgHash)).toString('hex');
    const cred: BeneficiaryCredential = { ...base, issuer_signature: sig };
    const err = await verifyCredential(cred, WALLET_A);
    expect(err).not.toBeNull();
    expect(err).toMatch(/issuer/i);
  });

  it('rejects a credential with wrong version', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cred = makeCred({ version: '1' as any });
    const err = await verifyCredential(cred, WALLET_A);
    expect(err).not.toBeNull();
    expect(err).toMatch(/version/i);
  });

  it('rejects when merkle_path has wrong length', async () => {
    const cred = makeCred();
    const err = await verifyCredential({ ...cred, merkle_path: cred.merkle_path.slice(0, 6) }, WALLET_A);
    expect(err).not.toBeNull();
    expect(err).toMatch(/8 element/i);
  });
});

describe('credential QR payloads', () => {
  it('round-trips a signed credential through the legacy QR payload format', async () => {
    const cred = makeCred();
    const payload = encodeCredentialQr(cred);
    expect(payload.startsWith(CREDENTIAL_QR_PREFIX)).toBe(true);
    await expect(decodeCredentialQr(payload)).resolves.toEqual(cred);
  });

  it('round-trips a signed credential through encrypted QR with a passphrase', async () => {
    const cred = makeCred();
    const payload = await encodeEncryptedCredentialQr(cred, 'field-passphrase-42');
    expect(payload.startsWith(ENCRYPTED_CREDENTIAL_QR_PREFIX)).toBe(true);
    expect(payload).not.toContain(cred.secret);
    await expect(decodeCredentialQr(payload, 'field-passphrase-42')).resolves.toEqual(cred);
  });

  it('rejects encrypted QR payloads without the correct passphrase', async () => {
    const cred = makeCred();
    const payload = await encodeEncryptedCredentialQr(cred, 'field-passphrase-42');
    await expect(decodeCredentialQr(payload)).rejects.toThrow(/passphrase|required|decrypt/i);
    await expect(decodeCredentialQr(payload, 'wrong-passphrase')).rejects.toThrow(/decrypt|passphrase/i);
  });

  it('also accepts raw credential JSON for backwards-compatible paste flow', async () => {
    const cred = makeCred();
    await expect(decodeCredentialQr(prettyCredentialJson(cred))).resolves.toEqual(cred);
  });
});
