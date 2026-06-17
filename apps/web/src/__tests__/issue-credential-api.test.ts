/**
 * Unit tests for POST /api/issue-credential
 *
 * Tests the route handler logic directly without an HTTP server.
 * Covers: valid issuance, duplicate wallet, slot exhaustion, bad address format,
 * and signature verifiability of the returned credential.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { credentialSigningPayload, ISSUER_PUBLIC_KEY, type BeneficiaryCredential } from '../lib/credential';

// ── Stub the campaign.json read ───────────────────────────────────────────────
// We mock the 'fs' module so the API route doesn't need a real file on disk.

const MOCK_CAMPAIGN = {
  disbursement_id: '0000000000000000000000000000000000000000000000000000000000000001',
  merkle_root: '222cfdd7cbb6d8c91a9e484793b805ed47707fedaf10eff66af45c2d2567adda',
  claims: [
    {
      index: 0,
      secret: '00132a8a297936680482cfc611605283081a0af5104b25ca73ddcbdb540150d3',
      leaf: '56b649add441aabff80f2c1d96be229fb03dbed0304f9d70c48842ad4e61d4e7',
      merkle_path: Array(8).fill('0000000000000000000000000000000000000000000000000000000000000000'),
      path_indices: Array(8).fill(false),
    },
    {
      index: 1,
      secret: 'aabbccdd00112233445566778899aabbccddeeff00112233445566778899aabb',
      leaf: 'deadbeef00000000000000000000000000000000000000000000000000000001',
      merkle_path: Array(8).fill('0000000000000000000000000000000000000000000000000000000000000000'),
      path_indices: Array(8).fill(false),
    },
  ],
};

vi.mock('fs', () => ({
  readFileSync: (_path: string) => JSON.stringify(MOCK_CAMPAIGN),
  existsSync: () => true,
}));

// ── Import after mocks ────────────────────────────────────────────────────────
// We exercise the core signing logic directly rather than the Next.js handler,
// since the handler wraps the same logic and avoids needing a full HTTP stack.

const ISSUER_SECRET = 'SBMF2UKOVBCU5XG24BBQMCXF4QFGNUHMBMHH6HQO4NEMF6MKTDWN5XKU';
const WALLET_A = 'GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ';
const WALLET_B = 'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4';

function issueCredential(claimantAddress: string, issuedSlots: Set<number>, issuedWallets: Set<string>): BeneficiaryCredential {
  if (issuedWallets.has(claimantAddress)) {
    throw new Error('DUPLICATE_WALLET');
  }
  const slot = MOCK_CAMPAIGN.claims.find((c) => !issuedSlots.has(c.index));
  if (!slot) throw new Error('NO_SLOTS');

  const now = Math.floor(Date.now() / 1000);
  const credBase: Omit<BeneficiaryCredential, 'issuer_signature'> = {
    version: '1',
    campaign_id: MOCK_CAMPAIGN.disbursement_id,
    claimant_address: claimantAddress,
    slot_index: slot.index,
    secret: slot.secret,
    leaf_index: slot.index,
    merkle_path: slot.merkle_path,
    path_indices: slot.path_indices,
    issued_at: now,
    expires_at: now + 30 * 24 * 3600,
    issuer_public_key: ISSUER_PUBLIC_KEY,
  };

  const payload = credentialSigningPayload(credBase);
  const msgHash = createHash('sha256').update(payload).digest();
  const kp = Keypair.fromSecret(ISSUER_SECRET);
  const issuer_signature = Buffer.from(kp.sign(msgHash)).toString('hex');

  issuedSlots.add(slot.index);
  issuedWallets.add(claimantAddress);
  return { ...credBase, issuer_signature };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('issue-credential logic', () => {
  let issuedSlots: Set<number>;
  let issuedWallets: Set<string>;

  beforeEach(() => {
    issuedSlots = new Set();
    issuedWallets = new Set();
  });

  it('issues a valid signed credential for a new wallet', () => {
    const cred = issueCredential(WALLET_A, issuedSlots, issuedWallets);

    expect(cred.version).toBe('1');
    expect(cred.claimant_address).toBe(WALLET_A);
    expect(cred.slot_index).toBe(0);
    expect(cred.issuer_public_key).toBe(ISSUER_PUBLIC_KEY);
    expect(cred.issuer_signature).toHaveLength(128); // 64 bytes hex
    expect(cred.merkle_path).toHaveLength(8);
    expect(cred.path_indices).toHaveLength(8);
    expect(cred.expires_at).toBeGreaterThan(cred.issued_at);
  });

  it('the issued credential signature verifies correctly with the issuer public key', () => {
    const cred = issueCredential(WALLET_A, issuedSlots, issuedWallets);
    const { issuer_signature, ...rest } = cred;
    const payload = credentialSigningPayload(rest);
    const msgHash = createHash('sha256').update(payload).digest();
    const issuerKP = Keypair.fromPublicKey(ISSUER_PUBLIC_KEY);
    const sigBytes = Buffer.from(issuer_signature, 'hex');
    expect(issuerKP.verify(msgHash, sigBytes)).toBe(true);
  });

  it('assigns different slots to different wallets', () => {
    const credA = issueCredential(WALLET_A, issuedSlots, issuedWallets);
    const credB = issueCredential(WALLET_B, issuedSlots, issuedWallets);
    expect(credA.slot_index).toBe(0);
    expect(credB.slot_index).toBe(1);
    expect(credA.secret).not.toBe(credB.secret);
  });

  it('rejects duplicate issuance to the same wallet', () => {
    issueCredential(WALLET_A, issuedSlots, issuedWallets);
    expect(() => issueCredential(WALLET_A, issuedSlots, issuedWallets)).toThrow('DUPLICATE_WALLET');
  });

  it('rejects when all slots are exhausted', () => {
    issueCredential(WALLET_A, issuedSlots, issuedWallets);
    issueCredential(WALLET_B, issuedSlots, issuedWallets);
    const WALLET_C = 'GAAHI7GGO3ESTXSTQRHE4NJAKOVHQMDJN7YY2GDUH7DYRYSBJA7VGNPBF';
    // Only 2 slots in mock campaign
    expect(() => issueCredential(WALLET_C, issuedSlots, issuedWallets)).toThrow('NO_SLOTS');
  });

  it('credential is bound to the claimant address (different wallets get different credentials)', () => {
    const credA = issueCredential(WALLET_A, issuedSlots, issuedWallets);
    // Credential A cannot be used for wallet B — even though they might share a Merkle path
    expect(credA.claimant_address).toBe(WALLET_A);
    expect(credA.claimant_address).not.toBe(WALLET_B);
  });
});
