# Community Review Post

Use this message in Stellar Dev Discord `#zk-chat`, Dorahacks discussion, Telegram, or GitHub.

```text
Hi everyone, I’m submitting ZK AidShield for Stellar Hacks: Real-World ZK and would appreciate a focused security/design review.

Repo: https://github.com/cyberrockng/zk-aidshield
Live demo: https://zk-aidshield.vercel.app

What it does:
- Operator commits an eligible aid list as a Poseidon Merkle root.
- Beneficiary receives a wallet-bound signed credential.
- Browser generates a Groth16 proof locally.
- Soroban verifies the proof and releases testnet XLM once.
- Replay is blocked by nullifier storage.

Specific review targets:
1. Circuit public inputs and wallet/expiry/issuer binding.
2. Soroban verifier/disbursement interface.
3. Nullifier replay protection.
4. Issuer rotation/revocation model.
5. Credential issuance and browser witness trust boundary.

Known boundaries:
- Testnet hackathon deployment.
- Groth16 trusted setup is demo-grade; production needs a public ceremony.
- Stellar settlement metadata is public.

Issue for comments:
https://github.com/cyberrockng/zk-aidshield/issues

Any high-signal feedback before final submission would help.
```
