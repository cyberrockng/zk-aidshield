---
name: External Security Review
about: Request focused review of circuit, contract, verifier, and issuance security
title: "External security review request"
labels: security, review
assignees: cyberrockng
---

## Project

ZK AidShield is a Stellar testnet project for privacy-preserving crisis-aid disbursement.

Live demo: https://zk-aidshield.vercel.app

## Review Scope

Please focus on correctness and security issues that could affect eligibility, replay protection, issuer controls, or private witness handling.

## High-Value Review Targets

- Circuit constraints and public inputs.
- Soroban verifier/disbursement interface.
- Nullifier replay protection.
- Issuer registry, rotation, and revocation.
- Expiry enforcement.
- Credential issuance and admin API protection.
- Browser-side witness handling.

## Known Boundaries

- Testnet hackathon deployment.
- Groth16 trusted setup is demo-grade and needs a public ceremony before production/mainnet.
- Stellar settlement metadata remains public.
- Durable issuance storage should use Redis/Upstash with `REQUIRE_DURABLE_ISSUANCE=true` for production.

## Requested Finding Format

- Severity:
- Affected file/contract/circuit:
- Exploit scenario:
- Recommended fix:
- Hackathon blocker or production-only:
