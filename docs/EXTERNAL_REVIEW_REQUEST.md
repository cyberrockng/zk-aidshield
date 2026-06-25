# External Review Request

ZK AidShield is a Stellar testnet project for privacy-preserving crisis-aid disbursement. It uses a Poseidon Merkle eligibility commitment, browser-side Groth16 proof generation, and Soroban verification before XLM payout.

## Review Scope

Please focus on correctness and security issues that could affect eligibility, replay protection, issuer controls, or private witness handling.

## High-Value Review Targets

1. Circuit constraints
   - Leaf binds secret, disbursement ID, claimant address, expiry, and issuer key.
   - Nullifier cannot be reused across claims.
   - Public inputs match contract expectations.

2. Soroban disbursement contract
   - Verifier call and public-input encoding.
   - Nullifier replay protection.
   - Issuer registry and revocation behavior.
   - Expiry checks against ledger time.
   - Cash/voucher route replay behavior.

3. Verifier deployment
   - Verifier key initialization.
   - Verification key hash alignment with published artifacts.
   - Fresh verifier/disbursement deployment sequence.

4. Credential issuance
   - Server-only issuer secret.
   - Wallet-bound issued credential.
   - Durable issuance reservation design.
   - Admin API protection and rate limits.

5. Frontend trust boundary
   - Credential witness is used locally during proof generation.
   - Credential secret and Merkle witness are not sent on-chain or to the verifier.
   - Browser compromise risk is clearly disclosed.

## Known Boundaries

- Current deployment is testnet/hackathon grade.
- Trusted setup is demo-grade and needs a public ceremony before production.
- Stellar settlement metadata remains public.
- Upstash Redis should be configured for production-grade durable issuance uniqueness.

## Useful Commands

```bash
npm test
npm run build:web
npm run test:merkle
npm run contracts:test
npm audit
npm --prefix apps/web audit
npm --prefix packages/merkle-tools audit
npm --prefix circuits/aidshield-groth16 audit
npm run check:production
```

## Requested Output

Please comment with:

- severity,
- affected file/contract/circuit,
- exploit scenario,
- recommended fix,
- whether it blocks hackathon submission or only production/mainnet use.
