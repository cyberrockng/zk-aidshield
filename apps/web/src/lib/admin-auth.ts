import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  const configuredSecret = process.env.ADMIN_API_SECRET;
  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'ADMIN_API_SECRET is not configured on the server' },
      { status: 503 },
    );
  }

  const headerSecret =
    req.headers.get('x-admin-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!headerSecret || !constantTimeEqual(headerSecret, configuredSecret)) {
    return NextResponse.json({ error: 'Admin authorization required' }, { status: 401 });
  }

  return null;
}
