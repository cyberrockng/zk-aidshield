import { createHash } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireAdmin } from '../lib/admin-auth';
import { createLedgerEntry, reserveIssuance } from '../lib/issuance-ledger-store';
import type { BeneficiaryCredential } from '../lib/credential';

function request(secret?: string): NextRequest {
  return new NextRequest('http://localhost/api/protected', {
    headers: secret ? { 'x-admin-secret': secret } : undefined,
  });
}

const credential: BeneficiaryCredential = {
  version: '2',
  campaign_id: '0000000000000000000000000000000000000000000000000000000000000001',
  claimant_address: 'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4',
  slot_index: 1,
  secret: '0056ca84070c28abf88d1b977383a28ee81606a5baf2bd138cca49ad44313bb5',
  leaf_index: 1,
  merkle_path: Array(8).fill('0000000000000000000000000000000000000000000000000000000000000000'),
  path_indices: Array(8).fill(false),
  issued_at: 1_781_859_825,
  expires_at: 1_784_448_421,
  issuer_key_id: '00b1f3a14c4a16cc3fc7e80804e3e7581170007147157f62c78386cec0393e5c',
  issuer_public_key: 'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4',
  issuer_signature: '00'.repeat(64),
};

describe('admin API hardening', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects protected route access when ADMIN_API_SECRET is missing', () => {
    vi.stubEnv('ADMIN_API_SECRET', '');

    const response = requireAdmin(request());

    expect(response?.status).toBe(503);
  });

  it('rejects protected route access without the admin secret header', () => {
    vi.stubEnv('ADMIN_API_SECRET', 'demo-secret');

    const response = requireAdmin(request());

    expect(response?.status).toBe(401);
  });

  it('allows protected route access with the matching admin secret header', () => {
    vi.stubEnv('ADMIN_API_SECRET', 'demo-secret');

    const response = requireAdmin(request('demo-secret'));

    expect(response).toBeNull();
  });

  it('uses a keyed HMAC for ledger wallet identifiers', () => {
    vi.stubEnv('LEDGER_HMAC_SECRET', 'ledger-secret');
    const plainHash = createHash('sha256').update(credential.claimant_address).digest('hex');

    const entry = createLedgerEntry(credential);

    expect(entry.claimant_address_hash).toHaveLength(64);
    expect(entry.claimant_address_hash).not.toBe(plainHash);
  });

  it('fails closed when durable issuance storage is required but Redis is missing', async () => {
    vi.stubEnv('LEDGER_HMAC_SECRET', 'ledger-secret');
    vi.stubEnv('REQUIRE_DURABLE_ISSUANCE', 'true');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');

    await expect(reserveIssuance(credential.campaign_id, credential.slot_index, credential.claimant_address))
      .rejects
      .toThrow(/Durable issuance storage is required/);
  });
});
