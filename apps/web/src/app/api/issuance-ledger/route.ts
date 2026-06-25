import { NextRequest, NextResponse } from 'next/server';
import type { DeliveryMode } from '@/lib/issuance-ledger';
import { readIssuanceLedger, recordLedgerDelivery } from '@/lib/issuance-ledger-store';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRateLimit } from '@/lib/rate-limit';

const DELIVERY_MODES = new Set<DeliveryMode>([
  'issued',
  'json_download',
  'json_copy',
  'encrypted_qr',
  'qr_payload_copy',
]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const rateLimitError = requireRateLimit(req, 'issuance-ledger:get', 30);
  if (rateLimitError) return rateLimitError;

  return NextResponse.json(readIssuanceLedger());
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const rateLimitError = requireRateLimit(req, 'issuance-ledger:post', 30);
  if (rateLimitError) return rateLimitError;

  let body: { credential_hash?: string; delivery_mode?: DeliveryMode };
  try {
    body = await req.json() as { credential_hash?: string; delivery_mode?: DeliveryMode };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.credential_hash || !/^[a-f0-9]{64}$/i.test(body.credential_hash)) {
    return NextResponse.json({ error: 'credential_hash must be a 64-char hex string' }, { status: 400 });
  }
  if (!body.delivery_mode || !DELIVERY_MODES.has(body.delivery_mode)) {
    return NextResponse.json({ error: 'Unsupported delivery_mode' }, { status: 400 });
  }

  const updated = recordLedgerDelivery(body.credential_hash.toLowerCase(), body.delivery_mode);
  if (!updated) return NextResponse.json({ error: 'Ledger entry not found' }, { status: 404 });

  return NextResponse.json({ entry: updated, ledger: readIssuanceLedger() });
}
