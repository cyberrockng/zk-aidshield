# Production Issuance Backend

The hackathon app includes durable issuance hooks. Production should run the backend with the following controls enabled.

## Required Environment

- `ADMIN_API_SECRET`: protects operator-only credential issuance.
- `ISSUER_SECRET_KEY`: server-only Stellar secret used to sign beneficiary credentials.
- `LEDGER_HMAC_SECRET`: hashes wallet, campaign, and credential fields in the non-PII ledger.
- `REQUIRE_DURABLE_ISSUANCE=true`: prevents fallback to in-memory issuance.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: durable `SET NX` reservation storage.
- `CAMPAIGN_JSON`: server-only campaign data containing private claim witnesses.

## Backend Guarantees

- One reservation per campaign slot.
- One reservation per claimant wallet hash.
- One HMAC-hashed ledger entry per credential.
- Delivery modes recorded without storing raw credential data.
- Admin API rejects unauthenticated issuance attempts.
- Rate limits apply to issuance and ledger endpoints.

## Production Additions

- Per-issuer issuance quotas.
- Signed admin action log.
- Multi-admin approval for root updates, issuer revocation, and emergency unpause.
- Exportable audit bundle containing only non-PII hashes and timestamps.
- Alerting on repeated issuance failures, replay attempts, and abnormal delivery patterns.

## Non-Negotiables

Never store raw beneficiary names, IDs, credential secrets, QR passphrases, Merkle paths, issuer secrets, or campaign private witnesses in a public database or repository.
