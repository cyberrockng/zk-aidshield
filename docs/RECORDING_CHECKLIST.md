# Recording Checklist

Target length: 2-3 minutes.

## Browser Setup

- Freighter installed and set to Stellar Testnet.
- Use the deployed Phase 6 frontend or local `http://localhost:3000`.
- Keep the operator `ADMIN_API_SECRET` ready for `/admin`; do not show it in the recording.
- Keep Stellar Explorer tabs ready for:
  - Disbursement: `https://stellar.expert/explorer/testnet/contract/CDCT4TCFKSIBOCFV6OATUJB2Y3GOF72KIG7NLOAK7Z4HMGYF4PE3V5NC`
  - Verifier: `https://stellar.expert/explorer/testnet/contract/CAVU2HNFWXALJG2FNFWZA4Y3WBV7VL5W7LBP4WYMZQFG26XHQNLTSAHQ`

## Script

1. Show `/judges`: "This is privacy-preserving aid payout infrastructure on Stellar."
2. Show `/auditor`: "50 XLM is funded in escrow; each valid proof releases 1 XLM, and auditors can inspect settlement without seeing the private beneficiary list."
3. Show `/admin`: enter the admin secret off-camera, issue a credential to the connected testnet wallet, set a QR passphrase, and display the encrypted QR.
4. Show `/admin`: approve/check a vendor address in Vendor / Voucher Mode.
5. Show `/admin`: open the non-PII issuance ledger and point out keyed wallet identifiers, credential hashes, issuer key, expiry, and delivery mode.
6. Show `/claim`: enter the passphrase, import the credential by QR image, file, or paste, verify it, and choose cash or vendor voucher.
7. Generate proof: "The secret stays in-browser; the proof is 384 bytes."
7. Approve Freighter transaction.
8. Show success, Explorer transaction, and download/copy claim receipt.
9. Return to `/auditor`: claimed count and escrow changed.
10. Retry claim: show nullifier replay rejection.
11. Open `/audit`: "Expiry, issuer registry, replay protection, and approved-vendor voucher controls are enforced on-chain."

## Lines To Say

- "No name, ID, or beneficiary list is stored on-chain."
- "The Merkle leaf binds wallet, expiry, and issuer key."
- "Field officers can deliver an encrypted credential QR without changing the private eligibility proof path."
- "Operators get an admin-protected non-PII issuance ledger: keyed identifiers and counts, not beneficiary identities."
- "Beneficiaries can keep a private receipt without exposing their aid-list credential."
- "The contract rejects expired or revoked-issuer credentials."
- "The nullifier makes double claims impossible."
- "Voucher mode lets an approved vendor receive payment while the beneficiary still proves eligibility privately."
- "Auditors can verify funds and claim counts without seeing the private eligibility list."
- "The payout wallet and timing are public settlement data; the sensitive aid-list membership and credential witness stay private."
