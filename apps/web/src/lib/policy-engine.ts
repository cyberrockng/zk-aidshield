export type ControlStatus = 'blocked' | 'monitored' | 'limited';
export type ControlLayer = 'zk-circuit' | 'soroban' | 'operator' | 'auditor';

export interface PolicyInput {
  paused: boolean;
  issuerActive: boolean;
  vendorActive: boolean;
  governanceThreshold: number;
  escrowBalanceStroops: bigint;
  payoutAmountStroops: bigint;
  claimedCount: number;
  ledgerEntries: number;
}

export interface PolicyControl {
  id: string;
  title: string;
  status: ControlStatus;
  layer: ControlLayer;
  evidence: string;
  weakness?: string;
}

export interface PolicyPosture {
  score: number;
  label: 'Submission ready' | 'Operationally strong' | 'Needs operator action';
  controls: PolicyControl[];
  blockedCount: number;
  monitoredCount: number;
  limitedCount: number;
  remainingClaims: number;
}

function statusWeight(status: ControlStatus): number {
  if (status === 'blocked') return 1;
  if (status === 'monitored') return 0.72;
  return 0.38;
}

export function evaluatePolicy(input: PolicyInput): PolicyPosture {
  const remainingClaims = input.payoutAmountStroops > 0n
    ? Number(input.escrowBalanceStroops / input.payoutAmountStroops)
    : 0;

  const controls: PolicyControl[] = [
    {
      id: 'proof-membership',
      title: 'Forged eligibility proofs',
      status: 'blocked',
      layer: 'zk-circuit',
      evidence: 'Groth16 proof must verify against the committed Merkle root before any payout.',
    },
    {
      id: 'wallet-binding',
      title: 'Stolen credential from another wallet',
      status: 'blocked',
      layer: 'zk-circuit',
      evidence: 'The Merkle leaf binds secret, campaign, claimant wallet, expiry, and issuer key.',
    },
    {
      id: 'replay',
      title: 'Double claim or cash-plus-voucher replay',
      status: 'blocked',
      layer: 'soroban',
      evidence: 'A spent nullifier is persisted on-chain and blocks all future claim routes.',
    },
    {
      id: 'issuer-revocation',
      title: 'Compromised or revoked issuer',
      status: input.issuerActive ? 'blocked' : 'limited',
      layer: 'soroban',
      evidence: input.issuerActive
        ? 'Current issuer key is active and can be revoked on-chain.'
        : 'Current issuer key is not active; claims from this campaign issuer would fail.',
      weakness: input.issuerActive ? undefined : 'Reactivate the valid issuer or regenerate the campaign with an active issuer key.',
    },
    {
      id: 'voucher-abuse',
      title: 'Unauthorized vendor redemption',
      status: input.vendorActive ? 'blocked' : 'monitored',
      layer: 'soroban',
      evidence: input.vendorActive
        ? 'Voucher route pays only approved vendor addresses.'
        : 'Voucher route is protected, but no demo vendor is currently approved.',
      weakness: input.vendorActive ? undefined : 'Approve a demo vendor before presenting the voucher flow.',
    },
    {
      id: 'emergency-stop',
      title: 'Active incident response',
      status: input.paused ? 'monitored' : 'blocked',
      layer: 'operator',
      evidence: input.paused
        ? 'Claims are currently paused; operators can investigate before funds move.'
        : 'Claims are live, and the emergency pause switch is available for incidents.',
    },
    {
      id: 'governance',
      title: 'Single-admin takeover of sensitive controls',
      status: input.governanceThreshold >= 2 ? 'blocked' : 'monitored',
      layer: 'operator',
      evidence: input.governanceThreshold >= 2
        ? `Sensitive operations require threshold-${input.governanceThreshold} approval.`
        : 'Governance is available, but the current threshold is one admin signature.',
      weakness: input.governanceThreshold >= 2 ? undefined : 'Raise threshold to 2 for a stronger live governance demo.',
    },
    {
      id: 'escrow-health',
      title: 'Underfunded campaign claims',
      status: remainingClaims > 0 ? 'blocked' : 'limited',
      layer: 'auditor',
      evidence: remainingClaims > 0
        ? `${remainingClaims} claim(s) can still be paid from live escrow.`
        : 'Escrow cannot cover another claim at the current payout amount.',
      weakness: remainingClaims > 0 ? undefined : 'Fund escrow before a live claim demo.',
    },
    {
      id: 'issuance-ledger',
      title: 'Opaque field issuance',
      status: input.ledgerEntries > 0 ? 'monitored' : 'limited',
      layer: 'auditor',
      evidence: input.ledgerEntries > 0
        ? `${input.ledgerEntries} non-PII issuance ledger entr${input.ledgerEntries === 1 ? 'y' : 'ies'} available for operator audit.`
        : 'No non-PII issuance ledger entries are visible yet.',
      weakness: input.ledgerEntries > 0 ? undefined : 'Issue at least one credential through the admin flow before recording.',
    },
  ];

  const weighted = controls.reduce((sum, control) => sum + statusWeight(control.status), 0);
  const score = Math.round((weighted / controls.length) * 100);
  const blockedCount = controls.filter((control) => control.status === 'blocked').length;
  const monitoredCount = controls.filter((control) => control.status === 'monitored').length;
  const limitedCount = controls.filter((control) => control.status === 'limited').length;

  return {
    score,
    label: score >= 90 ? 'Submission ready' : score >= 78 ? 'Operationally strong' : 'Needs operator action',
    controls,
    blockedCount,
    monitoredCount,
    limitedCount,
    remainingClaims,
  };
}
