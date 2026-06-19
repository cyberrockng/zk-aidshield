# Recording Checklist

Target length: 2-3 minutes.

## Browser Setup

- Freighter installed and set to Stellar Testnet.
- Use the deployed Phase 4 frontend or local `http://localhost:3000`.
- Keep Stellar Explorer tabs ready for:
  - Disbursement: `https://stellar.expert/explorer/testnet/contract/CDKODSLWLQ6FSRMDEFWLOMCTQOKJ6PTNAJE3RNJYL7NJFQ3JDRBLAHFO`
  - Verifier: `https://stellar.expert/explorer/testnet/contract/CAUJSUQBLM4E4N2CW26M2FJ2CM2LV4BE44PS76V7AYIN77DVDA7ZPYP4`

## Script

1. Show `/judges`: "This is privacy-preserving aid payout infrastructure on Stellar."
2. Show `/stats`: "50 XLM is funded in escrow; each valid proof releases 1 XLM."
3. Show `/admin`: issue a credential to the connected testnet wallet.
4. Show `/claim`: upload/paste credential and verify it.
5. Generate proof: "The secret stays in-browser; the proof is 384 bytes."
6. Approve Freighter transaction.
7. Show success and Explorer transaction.
8. Return to `/stats`: claimed count and escrow changed.
9. Retry claim: show nullifier replay rejection.
10. Open `/audit`: "Expiry and issuer registry are enforced on-chain in Phase 4."

## Lines To Say

- "No name, ID, or beneficiary list is stored on-chain."
- "The Merkle leaf binds wallet, expiry, and issuer key."
- "The contract rejects expired or revoked-issuer credentials."
- "The nullifier makes double claims impossible."
- "Auditors can verify funds and claim counts without seeing identities."
