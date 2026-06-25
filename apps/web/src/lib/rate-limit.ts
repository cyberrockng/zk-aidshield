import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function clientKey(req: NextRequest, scope: string): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = req.headers.get('x-real-ip');
  const adminSecret = req.headers.get('x-admin-secret') ?? req.headers.get('authorization') ?? 'anonymous';
  return `${scope}:${sha256Hex(`${forwarded ?? realIp ?? 'unknown'}:${adminSecret}`)}`;
}

export function requireRateLimit(
  req: NextRequest,
  scope: string,
  limit = Number(process.env.ADMIN_RATE_LIMIT_MAX ?? 30),
  windowMs = Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS ?? 60_000),
): NextResponse | null {
  if (process.env.DISABLE_ADMIN_RATE_LIMIT === 'true') return null;

  const now = Date.now();
  const key = clientKey(req, scope);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return NextResponse.json(
    { error: 'Too many admin requests. Retry after the rate-limit window resets.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(current.resetAt / 1000)),
      },
    },
  );
}
