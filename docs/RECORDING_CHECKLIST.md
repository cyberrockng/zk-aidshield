# Recording Checklist

Target length: 2-3 minutes.

## Browser Setup

- Freighter installed and set to Stellar Testnet.
- Use the deployed Phase 4 frontend or local `http://localhost:3000`.
- Keep Stellar Explorer tabs ready for:
  - Disbursement: `https://stellar.expert/explorer/testnet/contract/CD3FMAN3VJ6W6AHCH7CS3GIV56OO7BKBH5H2DIXT2H4TDZOUSMSSSGRC`
  - Verifier: `https://stellar.expert/explorer/testnet/contract/CAVU2HNFWXALJG2FNFWZA4Y3WBV7VL5W7LBP4WYMZQFG26XHQNLTSAHQ`

## Script

1. Show `/judges`: "This is privacy-preserving aid payout infrastructure on Stellar."
2. Show `/stats`: "50 XLM is funded in escrow; each valid proof releases 1 XLM."
3. Show `/admin`: issue a credential to the connected testnet wallet, set a QR passphrase, and display the encrypted QR.
4. Show `/admin`: open the non-PII issuance ledger and point out wallet/credential hashes.
5. Show `/claim`: enter the passphrase, import the credential by QR image, file, or paste, and verify it.
6. Generate proof: "The secret stays in-browser; the proof is 384 bytes."
7. Approve Freighter transaction.
8. Show success, Explorer transaction, and download/copy claim receipt.
9. Return to `/stats`: claimed count and escrow changed.
10. Retry claim: show nullifier replay rejection.
11. Open `/audit`: "Expiry and issuer registry are enforced on-chain in Phase 4."

## Lines To Say

- "No name, ID, or beneficiary list is stored on-chain."
- "The Merkle leaf binds wallet, expiry, and issuer key."
- "Field officers can deliver an encrypted credential QR without changing the anonymous claim path."
- "Operators get a non-PII issuance ledger: hashes and counts, not beneficiary identities."
- "Beneficiaries can keep a private receipt without revealing who they are."
- "The contract rejects expired or revoked-issuer credentials."
- "The nullifier makes double claims impossible."
- "Auditors can verify funds and claim counts without seeing identities."
