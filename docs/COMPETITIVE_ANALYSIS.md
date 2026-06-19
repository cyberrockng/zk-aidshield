# ZK AidShield Competitive Analysis

Research date: 2026-06-19

## Positioning

ZK AidShield is strongest when positioned as a privacy-preserving cash disbursement rail for NGOs and relief programs: an operator commits an eligible beneficiary set, a recipient proves eligibility locally, and Soroban releases funds while preventing duplicate claims.

This is not just another identity wallet. The lead is the combination of:

- ZK membership proof for aid eligibility
- wallet-bound nullifier to stop replay and credential theft
- on-chain Groth16 verification on Stellar
- real escrow payout through the Stellar Asset Contract
- a judge-friendly operator and claimant workflow

## Comparator Projects

| Project | What they do well | Gap ZK AidShield can exploit |
| --- | --- | --- |
| Semaphore | Mature ZK group membership, nullifiers, audited circuits/contracts, generic anonymous signaling. | Ethereum-focused and generic. It does not ship a humanitarian payout workflow or Stellar-native escrow settlement. |
| MACI | Private voting/tallying with anti-collusion properties for high-stakes funding and governance. | Funding allocation is different from individual aid claims. AidShield can borrow anti-coercion ideas without becoming a voting system. |
| Self / OpenPassport | Strong privacy-preserving proofs from passports, ID cards, and Aadhaar; large repo and SDK ecosystem. | It proves identity attributes, not aid-list membership plus payout. AidShield can integrate it as optional intake, not replace the current claim layer. |
| Anon Aadhaar | Client-side ZK proof from government-signed Aadhaar data, React SDK, EVM verification. | Region-specific and identity-heavy. AidShield can learn from its SDK packaging and selective disclosure posture. |
| Human Passport | Sybil resistance, identity scoring, individual verifications, and documented Stellar support. | It is an eligibility signal provider. AidShield can use it as one optional pre-screening signal while keeping final aid-list membership private. |
| ICRC-aligned privacy-preserving aid research | Clear humanitarian threat model: privacy, dignity, accountability, scale, smart-card/mobile deployment. | Mostly research and physical-goods/wallet architecture. AidShield can productize the on-chain cash payout version and add operational UX. |
| World ID | Strong proof-of-humanity story, uniqueness, phone-stored private proof, ecosystem traction. | Biometric onboarding is sensitive for humanitarian settings. AidShield should support uniqueness as an optional plugin, not a mandatory dependency. |
| Gitcoin / quadratic funding ecosystem | Strong public-goods funding mechanics and fraud analysis. | Public-goods grants are donor allocation, not beneficiary disbursement. AidShield can add a donor/auditor funding layer later. |

## Current Strengths

- End-to-end demo is real: credential issue, client-side proving, Freighter signing, Soroban verification, XLM payout.
- Wallet-bound Merkle leaves reduce stolen credential risk.
- Replay protection is enforced on-chain with persistent nullifier storage.
- The audit page clearly separates on-chain, off-chain, and private guarantees.
- Tests cover credential logic, API behavior, Merkle hashing, and core Soroban claim flows.
- Stellar is a defensible chain choice for cash aid because settlement cost and wallet UX matter more than DeFi composability.

## Competitive Gaps

- At research time, the public GitHub README lagged the local implementation. Keep GitHub synchronized before judging because reviewers will inspect the public repo first.
- Credential expiry is now enforced on-chain, but campaign redeployment is needed after each circuit/key change.
- Issuer revocation is on-chain, but production still needs threshold-admin governance and durable issuance logs.
- Campaign capacity is fixed at 256 slots.
- There is no formal threat model document for operator compromise, coercion, lost phone, network shutdown, or vendor-assisted claims.
- There is no mobile/offline recovery story, which is central in humanitarian deployment research.
- Trusted setup is demo-grade. Production needs a public multi-party ceremony or a move to a proof system with a better setup story.
- No SDK/API surface yet for NGO partners, auditors, or donor dashboards.

## Best Integrations To Build Next

### 1. On-chain credential policy

Move credential validity from frontend-only checks into public inputs and contract checks:

- Add `expires_at` and `issuer_key_id` to public inputs.
- Store active issuer keys on-chain.
- Add `revoke_issuer`, `add_issuer`, and optional `campaign_not_after`.
- Reject claims after expiry at contract level.

This directly closes the highest-risk trust gap.

### 2. Multi-issuer campaign governance

Support several trusted field officers instead of one hardcoded issuer:

- threshold admin for campaign activation
- issuer registry with revocation
- per-issuer issuance limits
- event log for credentials issued by count, not identity

This makes the system look like NGO infrastructure rather than a single-demo server.

### 3. Optional proof-of-human / KYC adapters

Do not force biometric or government identity into the base product. Add optional intake adapters:

- Human Passport for Stellar-compatible individual verification
- Self/OpenPassport for passport-based eligibility checks
- Anon Aadhaar-style regional adapter pattern where legally appropriate

The key product message: identity checks happen before list commitment; the final claim proves private eligibility while public settlement still shows payout wallet, timing, amount, and nullifier.

### 4. Mobile-first claimant flow

Humanitarian users are more likely to use phones than desktop wallets:

- passkey-protected encrypted credential backup
- mobile wallet/deep link support
- QR transfer from field officer to beneficiary
- low-bandwidth proof asset preloading
- recovery flow for lost credential without double claim

This is where AidShield can beat generic ZK projects in the actual niche.

### 5. Vendor and voucher mode

Add a second campaign type where funds are restricted to approved vendors or categories:

- beneficiary proves budget eligibility
- vendor submits signed receipt/claim
- contract pays vendor or splits between vendor and beneficiary
- auditor sees totals by campaign/vendor without seeing recipient identity

This borrows from privacy-preserving humanitarian wallet research and expands beyond one-time cash payouts.

### 6. Donor/auditor transparency layer

Create a public dashboard that shows:

- escrow funded
- claims paid
- remaining funds
- proof verifier hash / VK hash
- campaign parameters
- issuer registry status
- anonymized claim timing histogram with privacy-preserving bucketing

This is the fastest way to look more serious than projects that only prove a cryptographic primitive.

### 7. Scale path

Move beyond fixed depth 8:

- configurable tree depth
- incremental Merkle tree updates
- campaign epochs
- batched claims where possible
- benchmark page for proving time, proof size, contract fee, and max beneficiaries

Judges and partners will ask what happens after 256 beneficiaries.

## Near-Term Priority

1. Update/push the public README so GitHub matches the local implementation.
2. Redeploy the upgraded circuit/verifier/disbursement stack and update frontend env values.
3. Add mobile QR credential import/export.
4. Add an auditor dashboard page with campaign integrity checks.
5. Add one optional Sybil/identity adapter stub, preferably Human Passport because its docs mention Stellar support.

## Sources

- Semaphore docs: https://docs.semaphore.pse.dev/
- MACI docs: https://maci.pse.dev/
- Self / OpenPassport repository: https://github.com/selfxyz/self
- Anon Aadhaar repository: https://github.com/anon-aadhaar/anon-aadhaar
- Human Passport docs: https://docs.passport.human.tech/
- Privacy-preserving humanitarian aid distribution research: https://arxiv.org/abs/2303.17343
- Low-cost privacy-preserving humanitarian wallet research: https://arxiv.org/abs/2410.15942
- World ID overview: https://world.org/world-id
