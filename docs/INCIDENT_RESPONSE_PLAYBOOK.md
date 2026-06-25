# Incident Response Playbook

AidShield should fail closed during a suspected attack.

## Incident Classes

- Issuer compromise: private issuer key may have leaked.
- Stolen credential: beneficiary QR or JSON credential is copied.
- Compromised frontend: hosted UI may exfiltrate witnesses before proof generation.
- Phishing: beneficiary is sent to a fake claim site.
- Vendor abuse: approved vendor attempts collusion or unauthorized redemption.
- Coercion: beneficiary is forced to claim to an attacker-controlled wallet.
- Admin compromise: operator API secret or deployment account may be exposed.

## Immediate Response

1. Pause the disbursement contract.
2. Revoke affected issuer or vendor keys.
3. Rotate `ADMIN_API_SECRET`, `ISSUER_SECRET_KEY`, and `LEDGER_HMAC_SECRET` if relevant.
4. Disable affected campaign issuance.
5. Preserve logs, transaction hashes, ledger snapshots, and deployment hashes.
6. Publish a non-PII incident note with affected campaign, contract, and remediation status.

## Recovery

- Generate a new campaign root if credential witnesses are broadly exposed.
- Reissue credentials only to verified wallets.
- Keep old nullifiers and receipts for public accountability.
- Unpause only after two-person review and documented root/issuer/vendor status.

## User Safety Message

Beneficiaries should be told that AidShield never asks for seed phrases. A real claim should only happen on the official domain and with Freighter set to the expected network.
