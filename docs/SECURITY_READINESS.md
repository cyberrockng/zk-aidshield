# Security Readiness Status

Last updated: 2026-06-25

## Fixed In The Current Hardening Pass

1. Issuer key exposure response
   - A new issuer key was generated locally.
   - The new issuer was registered on-chain.
   - The old issuer was revoked on-chain.
   - Public campaign root and issuer metadata were updated in the app and docs.

2. Durable issuance controls
   - Issuance reservations support Upstash Redis `SET NX` for campaign slot and wallet hash uniqueness.
   - `REQUIRE_DURABLE_ISSUANCE=true` makes production fail closed when Redis is missing.
   - Local-file reservation remains available only for demo/local mode.

3. Safe live smoke testing
   - `POST /api/issue-credential` supports `{ "dry_run": true }`.
   - Dry-run validates admin auth, campaign loading, wallet registration, slot availability, expiry, and issuer metadata.
   - Dry-run does not sign, reserve, or return credential witness fields.

4. Admin API abuse reduction
   - Admin-only APIs are rate-limited in process.
   - Limits are configurable with `ADMIN_RATE_LIMIT_MAX` and `ADMIN_RATE_LIMIT_WINDOW_MS`.

5. Secret handling
   - Active issuer secret stays in local/Vercel secret storage only.
   - The repository secret scan should only report placeholders/templates, not live secret values.

## Still Honest Demo/Testnet Boundaries

1. Trusted setup
   - The Groth16 setup is hackathon/demo-grade.
   - Mainnet use needs a public multi-party ceremony or a migration to a setup-minimized proof system.

2. Browser proving
   - The witness is used locally in the browser and is not sent on-chain or to the verifier.
   - A compromised frontend could still exfiltrate the witness before proving.
   - Production should add stronger supply-chain controls, monitored deploys, and preferably a wallet/local prover path.

3. Public settlement metadata
   - Stellar settlement reveals transaction hash, route, timing, amount, claimant/vendor wallet, contract IDs, root, and nullifier.
   - AidShield hides beneficiary-list membership and witness data, not final settlement metadata.

4. External infrastructure
   - Upstash Redis must be created and configured before enabling `REQUIRE_DURABLE_ISSUANCE=true`.
   - Independent circuit/contract audit and monitoring are still production work.

## Readiness Commands

```bash
npm run check:production
npm test
npm run build:web
npm run test:merkle
npm run contracts:test
```

The production checker does not print secret values. It only reports whether required controls are configured.
