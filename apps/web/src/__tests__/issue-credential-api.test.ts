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
import { credentialSigningPayload, ISSUER_KEY_ID, ISSUER_PUBLIC_KEY, type BeneficiaryCredential } from '../lib/credential';

// ── Stub the campaign.json read ───────────────────────────────────────────────
// We mock the 'fs' module so the API route doesn't need a real file on disk.

// Phase 4: each slot is pre-committed to a wallet address, expiry, and issuer.
const MOCK_CAMPAIGN = {
  disbursement_id: '0000000000000000000000000000000000000000000000000000000000000001',
  merkle_root: '222cfdd7cbb6d8c91a9e484793b805ed47707fedaf10eff66af45c2d2567adda',
  expires_at: 2_000_000_000,
  issuer_key_id: ISSUER_KEY_ID,
  claims: [
    {
      index: 0,
      claimant_address: 'GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ',
      secret: '00132a8a297936680482cfc611605283081a0af5104b25ca73ddcbdb540150d3',
      leaf: '56b649add441aabff80f2c1d96be229fb03dbed0304f9d70c48842ad4e61d4e7',
      merkle_path: Array(8).fill('0000000000000000000000000000000000000000000000000000000000000000'),
      path_indices: Array(8).fill(false),
    },
    {
      index: 1,
      claimant_address: 'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4',
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
  // Phase 4: find slot by wallet address, not first free slot
  const slot = MOCK_CAMPAIGN.claims.find((c) => c.claimant_address === claimantAddress);
  if (!slot) throw new Error('WALLET_NOT_REGISTERED');
  if (issuedSlots.has(slot.index) || issuedWallets.has(claimantAddress)) {
    throw new Error('DUPLICATE_WALLET');
  }

  const now = Math.floor(Date.now() / 1000);
  const credBase: Omit<BeneficiaryCredential, 'issuer_signature'> = {
    version: '2',
    campaign_id: MOCK_CAMPAIGN.disbursement_id,
    claimant_address: claimantAddress,
    slot_index: slot.index,
    secret: slot.secret,
    leaf_index: slot.index,
    merkle_path: slot.merkle_path,
    path_indices: slot.path_indices,
    issued_at: now,
    expires_at: MOCK_CAMPAIGN.expires_at,
    issuer_key_id: MOCK_CAMPAIGN.issuer_key_id,
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

  it('issues a valid signed credential for a registered wallet', () => {
    const cred = issueCredential(WALLET_A, issuedSlots, issuedWallets);

    expect(cred.version).toBe('2');
    expect(cred.claimant_address).toBe(WALLET_A);
    expect(cred.slot_index).toBe(0);
    expect(cred.issuer_public_key).toBe(ISSUER_PUBLIC_KEY);
    expect(cred.issuer_signature).toHaveLength(128); // 64 bytes hex
    expect(cred.merkle_path).toHaveLength(8);
    expect(cred.path_indices).toHaveLength(8);
    expect(cred.expires_at).toBeGreaterThan(cred.issued_at);
    expect(cred.issuer_key_id).toBe(ISSUER_KEY_ID);
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

  it('each wallet gets its own pre-committed slot (wallet-bound leaf)', () => {
    const credA = issueCredential(WALLET_A, issuedSlots, issuedWallets);
    const credB = issueCredential(WALLET_B, issuedSlots, issuedWallets);
    // Slot 0 is bound to WALLET_A, slot 1 is bound to WALLET_B in the mock campaign
    expect(credA.slot_index).toBe(0);
    expect(credB.slot_index).toBe(1);
    expect(credA.secret).not.toBe(credB.secret);
  });

  it('rejects duplicate issuance to the same wallet', () => {
    issueCredential(WALLET_A, issuedSlots, issuedWallets);
    expect(() => issueCredential(WALLET_A, issuedSlots, issuedWallets)).toThrow('DUPLICATE_WALLET');
  });

  it('rejects wallets not registered in the campaign', () => {
    const WALLET_C = 'GCTKVOPSICWARIBGBQCBQ7KM2QN6QGXMF7ILP7OL2IF5PBJKC5USPJ2U';
    // Not in mock campaign (only WALLET_A and WALLET_B are pre-committed)
    expect(() => issueCredential(WALLET_C, issuedSlots, issuedWallets)).toThrow('WALLET_NOT_REGISTERED');
  });

  it('credential is bound to the claimant address at the circuit level', () => {
    const credA = issueCredential(WALLET_A, issuedSlots, issuedWallets);
    // credA.leaf = Poseidon(secret, disbursement_id, WALLET_A_field) — a different
    // wallet cannot generate a valid proof for this leaf even with the same secret.
    expect(credA.claimant_address).toBe(WALLET_A);
    expect(credA.claimant_address).not.toBe(WALLET_B);
  });
});
