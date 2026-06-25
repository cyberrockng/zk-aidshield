# Privacy Disclosure

AidShield protects aid-list eligibility. It is not a full anonymous payment network.

## Hidden From Chain

- Beneficiary name.
- Internal ID or case number.
- Credential secret.
- Merkle path and list index.
- Eligibility-list membership witness.
- Issuer private key and campaign private witness file.

## Public On Stellar

- Claimant wallet.
- Transaction hash.
- Amount.
- Ledger timing.
- Disbursement contract ID.
- Verifier contract ID.
- Merkle root.
- Nullifier.
- Vendor wallet for voucher redemption.

## Privacy Claim

A beneficiary can prove membership in an approved aid list without publishing their underlying credential or list record. Replay protection uses a public nullifier so the same private eligibility cannot be spent twice.

## Non-Claims

AidShield does not hide wallet activity, payout timing, payout amount, vendor address, or network-level metadata. Production deployments should combine AidShield with safe wallet guidance, phishing protection, and field privacy procedures.

## Demo Scale Boundary

The current demo circuit uses an 8-level Merkle tree, which supports 256 claim slots per campaign. Production deployments can increase tree depth, but doing so requires regenerating the circuit artifacts, verifier key, campaign root, and verifier/disbursement deployment stack.

## Replay Retention Boundary

Nullifier retention must cover the full claim horizon for any real campaign. If a deployment uses TTL-based storage extension, the retention window must be longer than the campaign claim period plus any dispute/reconciliation window.
