import { describe, expect, it } from 'vitest';
import { evaluatePolicy } from '../lib/policy-engine';

describe('policy engine', () => {
  it('scores a fully controlled campaign as submission ready', () => {
    const posture = evaluatePolicy({
      paused: false,
      issuerActive: true,
      vendorActive: true,
      governanceThreshold: 2,
      escrowBalanceStroops: 50_000_000n,
      payoutAmountStroops: 10_000_000n,
      claimedCount: 1,
      ledgerEntries: 2,
    });

    expect(posture.label).toBe('Submission ready');
    expect(posture.score).toBeGreaterThanOrEqual(90);
    expect(posture.remainingClaims).toBe(5);
    expect(posture.controls.find((control) => control.id === 'replay')?.status).toBe('blocked');
  });

  it('surfaces operational gaps without weakening ZK guarantees', () => {
    const posture = evaluatePolicy({
      paused: false,
      issuerActive: false,
      vendorActive: false,
      governanceThreshold: 1,
      escrowBalanceStroops: 0n,
      payoutAmountStroops: 10_000_000n,
      claimedCount: 0,
      ledgerEntries: 0,
    });

    expect(posture.label).toBe('Needs operator action');
    expect(posture.controls.find((control) => control.id === 'proof-membership')?.status).toBe('blocked');
    expect(posture.controls.find((control) => control.id === 'issuer-revocation')?.status).toBe('limited');
    expect(posture.limitedCount).toBeGreaterThan(0);
  });
});
