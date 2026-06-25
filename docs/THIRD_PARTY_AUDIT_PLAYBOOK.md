# Third-Party Audit Playbook

This playbook tells an external reviewer how to audit ZK AidShield without needing private production secrets or real beneficiary data.

## Audit Objective

The reviewer should independently answer three questions:

1. Does the ZK circuit prove the intended private eligibility statement?
2. Do the Soroban contracts enforce the public settlement, replay, issuer, vendor, pause, and governance rules?
3. Do the API, frontend, and deployment controls avoid leaking credentials or overstating privacy guarantees?

## Reviewer Handoff Package

Provide the reviewer:

- Repository URL and exact commit hash under review.
- Live testnet app URL.
- Disbursement contract ID, verifier contract ID, XLM SAC address, Merkle root, disbursement ID, issuer public key, and verifier key hash.
- Circuit source, proving artifacts, verifier key JSON, and setup notes.
- Deployment scripts and environment-variable template.
- README, threat model, privacy disclosure, production hardening notes, trusted setup plan, and verification lab notes.
- A synthetic test credential generated from the test campaign only if the reviewer needs to reproduce the live claim flow.
- Expected commands:

```bash
npm run verify:proof
npm run contracts:test
npm --prefix apps/web test
npm --prefix apps/web run test:e2e
npm --prefix packages/merkle-tools test
npm run secret:scan
npm run audit:all
```

Do not provide seed phrases, Freighter recovery phrases, real beneficiary data, production issuer secrets, or private donor/NGO records.

## Phase 1: Architecture And Trust Boundaries

The reviewer should map:

```text
NGO/operator
-> beneficiary campaign list
-> Merkle tree generation
-> private credential issuance
-> QR/claim-pass delivery
-> browser proof generation
-> Freighter transaction signing
-> Soroban verifier contract
-> disbursement contract
-> XLM settlement
-> nullifier replay protection
-> public donor/auditor/receipt views
```

They should classify each boundary as private, public, trusted, or adversarial:

- Admin/operator API.
- Issuer secret and issuer public key.
- Beneficiary credential JSON and QR payload.
- Browser proving environment.
- Freighter wallet.
- Soroban verifier contract.
- Disbursement contract.
- Upstash issuance reservation and non-PII ledger.
- Vercel environment variables and deployment pipeline.

## Phase 2: ZK Circuit Review

The reviewer should inspect the circuit and prove that:

- Merkle membership is enforced.
- Disbursement ID is bound into the statement.
- Claimant wallet field is bound into the statement.
- Expiry is exposed and later enforced by the contract.
- Issuer key ID is exposed and later checked by the contract.
- Nullifier derivation is deterministic and collision-resistant for the intended domain.
- Public signals are ordered exactly as the frontend and contracts expect.
- Stellar address-to-field conversion is documented and safe for the scalar field.
- The 8-level tree and 256-slot demo limit are intentional.

Required negative tests:

- Wrong secret fails.
- Wrong Merkle path fails.
- Wrong path index fails.
- Wrong root fails.
- Wrong disbursement ID fails.
- Wrong claimant wallet fails.
- Wrong issuer key ID fails or is rejected by the contract.
- Expired credential is rejected by the contract.

## Phase 3: Trusted Setup Review

Because Groth16 is setup-sensitive, the reviewer should confirm:

- The verifier key hash is reproducible from `circuits/aidshield-groth16/build/verification_key.json`.
- The deployed verifier contract was initialized with the verifier key matching the published hash.
- Circuit changes require regenerating the proving key, verifier key, verifier contract, disbursement configuration, and frontend constants.
- The current setup is documented as hackathon/demo-grade unless a public multi-party ceremony has been completed.

Production recommendation should include a public ceremony with transcript, contributor attestations, final verifier key hash, and fresh deployment.

## Phase 4: Soroban Verifier Contract Review

The reviewer should verify:

- Proof bytes and public inputs are decoded safely.
- Public inputs are consumed in the same order as the circuit emits them.
- BLS12-381 pairing verification is actually executed.
- Empty, malformed, wrong-length, or non-curve proof points are rejected.
- Uninitialized verifier state rejects verification.
- Initialization and any verifier-key update path cannot be hijacked.
- Cost behavior is acceptable for Stellar testnet and documented for production planning.

Required tests:

- Valid proof accepted.
- Empty proof rejected.
- Random proof rejected.
- Wrong public input rejected.
- Malformed curve point rejected.
- Uninitialized verifier rejected.

## Phase 5: Disbursement Contract Review

The reviewer should inspect:

- Initialization.
- Funding.
- Claim.
- Voucher claim.
- Issuer registry.
- Vendor registry.
- Pause/unpause.
- Root update.
- Verifier update.
- Governance threshold.
- Nullifier storage.
- Token transfer calls.

Required tests:

- Valid claim pays once.
- Same proof cannot claim twice.
- Same nullifier cannot claim twice.
- Wrong Merkle root is rejected.
- Wrong claimant wallet is rejected.
- Expired credential is rejected.
- Inactive or revoked issuer is rejected.
- Approved vendor can redeem voucher mode.
- Unapproved or revoked vendor is rejected.
- Paused campaign blocks claims.
- Threshold governance blocks unauthorized sensitive updates.
- Funding and payout move the expected token amount.

## Phase 6: API And Issuance Review

The reviewer should inspect:

- `/api/issue-credential`
- `/api/beneficiaries`
- `/api/issuance-ledger`
- `/api/verify-receipt`

Required checks:

- Missing admin secret returns 401.
- Wrong admin secret returns 401.
- Credential issuance requires pre-approved wallet and slot.
- Same wallet cannot receive two credentials for one campaign.
- Same slot cannot be issued twice.
- Durable Upstash reservation blocks duplicate issuance across deployments.
- Non-PII ledger stores hashes and operational metadata, not raw beneficiary identities.
- Issuer secret is never returned, logged, or committed.
- Ledger failure produces an operator recovery path instead of silently issuing an unverifiable credential.
- Receipt endpoint accurately claims transaction-status and declared-contract checks only.

## Phase 7: Frontend And Privacy Review

The reviewer should inspect the claim, admin, claim-pass, donor, receipt, command-center, impact, audit, readiness, and verification-lab pages.

Required checks:

- Credential JSON and witness values are not sent to third-party services.
- Private witness values are not printed to the console.
- QR payload warnings clearly tell beneficiaries to keep credentials private.
- Freighter signing cannot be confused with a non-wallet mock path.
- Claimant wallet mismatch is blocked before settlement.
- Pasted JSON cannot trigger unsafe rendering or script execution.
- Receipt page does not claim full event/amount/nullifier verification.
- Public pages state that Stellar settlement remains public.

## Phase 8: Infrastructure And Secrets Review

The reviewer should verify:

- No real secrets are committed.
- `.env.example` contains placeholders only.
- Vercel environment variables are scoped correctly.
- Upstash Redis token is private and rotated if exposed.
- `ADMIN_API_SECRET`, `ISSUER_SECRET`, `LEDGER_HMAC_SECRET`, and `UPSTASH_REDIS_REST_TOKEN` are strong and private.
- CI runs relevant tests before deployment.
- Dependency audit reports no unresolved known vulnerabilities.
- Security headers are present on production pages.

## Required Report Format

The final report should include:

- Repository URL and commit hash reviewed.
- Date range of review.
- Reviewer identity or organization.
- Scope and out-of-scope items.
- Commands executed and results.
- Deployed contract IDs and artifact hashes checked.
- Severity-ranked findings: Critical, High, Medium, Low, Informational.
- Reproduction steps for every finding.
- Recommended fix for every finding.
- Retest status after fixes.
- Final residual-risk statement.

Acceptable final wording after remediation:

```text
We reviewed ZK AidShield commit <hash>. The review covered the Circom Groth16 circuit, Soroban verifier, disbursement contract, credential issuance API, frontend claim flow, and deployment posture. No critical or high severity issues remain after remediation. Remaining production recommendations include public trusted setup, expanded receipt event decoding, and operational key management.
```

## Reviewer Rules

The reviewer must not:

- Request seed phrases or wallet recovery phrases.
- Use real beneficiary data.
- Push directly to `main` without project-owner review.
- Treat testnet payouts as production settlement guarantees.
- Mark external audit as complete until the report is published.
- Claim full payment anonymity; AidShield provides private eligibility with public Stellar settlement.
