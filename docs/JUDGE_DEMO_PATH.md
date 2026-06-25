# Judge Demo Path

Use `/demo-path` as the live walkthrough route for the submission video and judge review.

## 2-3 Minute Sequence

1. Open `/command-center` and show the product loop, verifier status, proof system, contract anchors, and live escrow state.
2. Open `/donor`, connect Freighter, fund escrow, and copy/download the donor proof-of-impact receipt.
3. Open `/admin`, enter the demo admin secret supplied in submission notes, issue a wallet-bound beneficiary credential, and export JSON or an encrypted QR payload.
4. Open `/claim`, load the credential, generate the Groth16 BLS12-381 proof in-browser, approve Freighter, and settle on Stellar testnet.
5. Try the same claim again and show the nullifier replay rejection.
6. Open `/receipt`, paste the receipt JSON, and verify transaction status plus the declared AidShield contract against Stellar testnet.
7. Finish on `/impact` or `/auditor` to show public impact, remaining capacity, nullifier accountability, and zero beneficiary PII exposure.

## Judge Message

AidShield is not only a ZK proof demo. It shows a full aid flow:

- public donor escrow funding,
- private credential issuance,
- local witness handling,
- on-chain Soroban proof verification,
- XLM settlement,
- nullifier replay blocking,
- public receipt and audit evidence.

The demo uses synthetic/testnet crisis-aid data and does not claim a live NGO deployment.

## No-Secret Review Path

If the reviewer does not have the demo admin secret, skip live issuance and inspect:

- `/claim-pass` for credential delivery format.
- `/verification-lab` for proof inputs, verifier anchors, and replay evidence.
- `/receipt` for transaction-status checks and receipt privacy boundaries.
- `/impact` and `/auditor` for public campaign state.

This path does not mint a fresh credential, but it still shows the ZK/Stellar proof surfaces without exposing operator-only controls.
