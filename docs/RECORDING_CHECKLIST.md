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
4. Show `/claim`: enter the passphrase, import the credential by QR image, file, or paste, and verify it.
5. Generate proof: "The secret stays in-browser; the proof is 384 bytes."
6. Approve Freighter transaction.
7. Show success and Explorer transaction.
8. Return to `/stats`: claimed count and escrow changed.
9. Retry claim: show nullifier replay rejection.
10. Open `/audit`: "Expiry and issuer registry are enforced on-chain in Phase 4."

## Lines To Say

- "No name, ID, or beneficiary list is stored on-chain."
- "The Merkle leaf binds wallet, expiry, and issuer key."
- "Field officers can deliver an encrypted credential QR without changing the anonymous claim path."
- "The contract rejects expired or revoked-issuer credentials."
- "The nullifier makes double claims impossible."
- "Auditors can verify funds and claim counts without seeing identities."
