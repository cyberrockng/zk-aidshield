import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { CONTRACT_ID } from '../lib/constants';
import { POST } from '../app/api/verify-receipt/route';

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/verify-receipt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('verify receipt API', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects zero transaction hashes', async () => {
    const response = await POST(request({ tx_hash: '0'.repeat(64) }));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/non-zero/);
  });

  it('reports transaction status and declared contract match without overclaiming event verification', async () => {
    vi.stubEnv('DISABLE_ADMIN_RATE_LIMIT', 'true');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      result: {
        status: 'SUCCESS',
        latestLedger: 123,
        createdAt: 456,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    const txHash = 'a'.repeat(64);
    const response = await POST(request({
      tx_hash: txHash,
      receipt: {
        tx_hash: txHash,
        contract: CONTRACT_ID,
      },
    }));
    const body = await response.json() as {
      verified?: boolean;
      receipt_verified?: boolean;
      receipt_status_verified?: boolean;
      checks?: { contract_match?: boolean; event_match?: string };
    };

    expect(response.status).toBe(200);
    expect(body.verified).toBe(true);
    expect(body.receipt_status_verified).toBe(true);
    expect(body.receipt_verified).toBe(false);
    expect(body.checks?.contract_match).toBe(true);
    expect(body.checks?.event_match).toBe('not_inspected');
  });
});
