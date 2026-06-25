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
