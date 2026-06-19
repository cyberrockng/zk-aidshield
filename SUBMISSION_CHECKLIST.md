# ZK AidShield Submission Checklist

## Final Demo Route

1. Open `/judges` and state the product in one line: privacy-preserving humanitarian payouts on Stellar.
2. Open `/stats` and show live testnet contracts, escrow, claim count, Merkle root, and verifier key hash.
3. Open `/admin`, enter `ADMIN_API_SECRET`, issue a wallet-bound credential, and show JSON plus encrypted QR delivery.
4. Show the admin-protected issuance ledger: slot, keyed wallet identifier, credential hash, issuer key, expiry, and delivery mode.
5. Open `/claim`, connect the matching Freighter account, load/decrypt the credential, and verify signature plus wallet binding.
6. Generate the Groth16 proof in-browser and approve the Soroban claim transaction in Freighter.
7. Show the Stellar Explorer transaction, local claim receipt, and updated stats.
8. Retry the same credential to show nullifier replay rejection.
9. Switch Freighter accounts and show wrong-wallet credential rejection.
10. Open `/audit` and `/judges` security posture to explain what is private, what is public, and what is production roadmap.

## Hosted Deployment Env

Set these server-side secrets in the hosting provider. Do not prefix them with `NEXT_PUBLIC_`:

- `ISSUER_SECRET_KEY`
- `ADMIN_API_SECRET`
- `LEDGER_HMAC_SECRET`
- `CAMPAIGN_JSON`

Set these browser-visible deployment values:

- `NEXT_PUBLIC_CONTRACT_ID`
- `NEXT_PUBLIC_VERIFIER_CONTRACT_ID`
- `NEXT_PUBLIC_XLM_SAC_ADDRESS`
- `NEXT_PUBLIC_ADMIN_ADDRESS`
- `NEXT_PUBLIC_DISBURSEMENT_ID`
- `NEXT_PUBLIC_MERKLE_ROOT`
- `NEXT_PUBLIC_ISSUER_PUBLIC_KEY`
- `NEXT_PUBLIC_ISSUER_KEY_ID`
- `NEXT_PUBLIC_VK_HASH`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_HORIZON_URL`
- `NEXT_PUBLIC_NETWORK_PASSPHRASE`
- `NEXT_PUBLIC_EXPLORER_BASE`

## Privacy Line To Use

AidShield hides names, IDs, beneficiary-list membership, credential secrets, and Merkle witnesses. Stellar settlement still publicly shows payout wallet, timing, amount, and nullifier for accountability.

## Final Checks

- `npm test` passes in `apps/web`.
- `npm run build` passes in `apps/web`.
- Freighter is on Stellar Testnet.
- Admin secret is available only to the operator/demo presenter.
- `apps/web/.env.local`, `.data`, and `packages/merkle-tools/campaign.json` remain ignored.
