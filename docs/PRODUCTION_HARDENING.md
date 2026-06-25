# Production Hardening Notes

ZK AidShield is a hackathon-ready testnet product. Production deployment requires these controls.

## Issuer Key Rotation

Run from the repo root:

```bash
npm run rotate:issuer
```

Store the printed `ISSUER_SECRET_KEY` only in `.env.local` and hosted environment variables. Never commit it. Regenerate the campaign with the new issuer key id, register the new issuer on-chain, then revoke the old issuer.

If any issuer secret has ever appeared in a public repo, treat it as compromised.

## Durable Issuance Uniqueness

Set these server-side variables in production:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
LEDGER_HMAC_SECRET=...
REQUIRE_DURABLE_ISSUANCE=true
```

When configured, `/api/issue-credential` reserves `campaign + slot` and `campaign + wallet_hash` keys with Redis `SET NX` before signing a credential. Without Redis, the app uses a locked local file fallback intended only for demos.

Set `REQUIRE_DURABLE_ISSUANCE=true` in production after Redis is configured. With that flag enabled, credential issuance fails closed instead of falling back to local files if Redis env vars are missing.

Use dry-run issuance for live deployment checks without consuming a slot:

```bash
curl -X POST https://zk-aidshield.vercel.app/api/issue-credential \
  -H "content-type: application/json" \
  -H "x-admin-secret: <admin-secret>" \
  --data '{"claimant_address":"<registered-wallet>","dry_run":true}'
```

The dry-run response intentionally omits credential secrets, Merkle paths, and issuer signatures.

## Admin API Rate Limits

Admin APIs are rate-limited in process:

```bash
ADMIN_RATE_LIMIT_MAX=30
ADMIN_RATE_LIMIT_WINDOW_MS=60000
DISABLE_ADMIN_RATE_LIMIT=false
```

For high-traffic production deployments, move rate limiting to a durable edge or Redis-backed limiter so limits survive serverless instance rotation.

## Browser Proving Trust Boundary

Browser proving means the beneficiary device and served frontend are trusted while the credential is loaded. A compromised frontend could exfiltrate the credential witness before proof generation. Mitigations:

- use strict deployment access controls,
- keep CSP/security headers enabled,
- serve only from the official domain,
- rotate credentials after suspected frontend compromise,
- prefer short credential expiries for field pilots.

## Public Settlement Boundary

Stellar settlement is public. AidShield hides aid-list membership and credential witness data, but observers can still see settlement wallet, route, timing, amount, contract ids, Merkle root, verifier key hash, and nullifier.

## Trusted Setup

The current Groth16 setup is demo-grade. Production should use a public multi-party ceremony or migrate to a proof system whose setup assumptions match the deployment risk.
