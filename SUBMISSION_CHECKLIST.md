# ZK AidShield Submission Checklist

## Final Demo Route

1. Open `/demo-path` and state the product in one line: private aid eligibility with public Stellar settlement accountability.
2. Open `/command-center` and show verifier status, live anchors, escrow state, and the product loop.
3. Open `/donor` if Freighter is ready and show donor escrow funding/receipt.
4. Open `/admin`, enter the private demo `ADMIN_API_SECRET`, issue a wallet-bound credential, and show JSON plus encrypted QR delivery.
5. If the judge does not have the admin secret, use the no-secret path: `/claim-pass`, `/verification-lab`, `/receipt`, `/impact`, and `/auditor`.
6. Open `/stats` only if the reviewer asks for raw live contract stats.
7. Show the admin-protected issuance ledger: slot, keyed wallet identifier, credential hash, issuer key, expiry, and delivery mode.
8. Open `/claim`, connect the matching Freighter account, load/decrypt the credential, and verify signature plus wallet binding.
9. Generate the Groth16 proof in-browser and approve the Soroban claim transaction in Freighter.
10. Show the Stellar Explorer transaction, stronger claim receipt, and updated stats.
11. Retry the same credential to show nullifier replay rejection.
12. Switch Freighter accounts and show wrong-wallet credential rejection.
13. Open `/threats`, `/pilot`, `/audit`, and `/judges` to explain what is private, what is public, what attacks fail, and what is production roadmap.

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

## Strongest Submission Line

ZK AidShield is not an anonymous faucet. It is a crisis-aid settlement system where ZK proves private eligibility, Soroban enforces one-time claims and policy controls, and donors can audit aggregate results without seeing the beneficiary list.

## Final Checks

- `npm test` passes in `apps/web`.
- `npm run build` passes in `apps/web`.
- Freighter is on Stellar Testnet.
- Admin secret is available only to the operator/demo presenter.
- `apps/web/.env.local`, `.data`, and `packages/merkle-tools/campaign.json` remain ignored.
