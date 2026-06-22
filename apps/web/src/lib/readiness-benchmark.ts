export interface CompetitiveProject {
  name: string;
  focus: string;
  before: number;
  after: number;
  gapClosed: string;
}

export const AIDSHIELD_BEFORE_SCORE = 88;
export const AIDSHIELD_AFTER_SCORE = 96;

export const COMPETITIVE_PROJECTS: CompetitiveProject[] = [
  {
    name: 'Tukar',
    focus: 'Confidential remittance corridor',
    before: 93,
    after: 91,
    gapClosed: 'AidShield now matches its selective disclosure and negative-proof clarity while keeping a stronger humanitarian workflow.',
  },
  {
    name: 'Nebula',
    focus: 'Confidential token infrastructure',
    before: 92,
    after: 90,
    gapClosed: 'AidShield now adds comparable proof telemetry and contract evidence, then leads on real field operations.',
  },
  {
    name: 'Open Stellar Passport',
    focus: 'ZK passport for agent payments',
    before: 90,
    after: 88,
    gapClosed: 'AidShield now mirrors the no-wallet judge path and replay/tamper evidence while staying closer to real-world aid payments.',
  },
  {
    name: 'x402 ZK Mesh',
    focus: 'Private AI-agent task marketplace',
    before: 87,
    after: 84,
    gapClosed: 'AidShield now turns zero-trust controls into a simpler threat simulator judges can verify quickly.',
  },
  {
    name: 'Auspex',
    focus: 'Proof-of-solvency and risk attestation',
    before: 85,
    after: 82,
    gapClosed: 'AidShield now borrows reserve-health language while proving a more complete user-facing payout system.',
  },
];

export const INTEGRATED_ADVANTAGES = [
  'Judge Proof Board: valid claim, replay, wrong wallet, expired credential, revoked issuer, unauthorized vendor, and pause controls.',
  'Selective Disclosure Panel: donor and regulator facts without beneficiary names, IDs, credential secrets, or Merkle paths.',
  'Proof Telemetry Panel: circuit, proof size, public inputs, verifier, root, VK hash, and expected proof lifecycle.',
  'No-Wallet Judge Mode: a guided demo path for reviewers who do not have Freighter ready.',
  'Threat Simulator: attack cases mapped to the exact layer that blocks or monitors them.',
  'Escrow Health Attestation: live reserve, payout amount, remaining claim capacity, and public settlement anchors.',
  'Mobile Field Officer Flow: QR credential delivery stays first-class instead of becoming a future-only claim.',
  'Competitive Positioning: AidShield is framed as humanitarian privacy plus accountability, not generic private payments.',
];

export function growthDelta(before: number, after: number): number {
  return after - before;
}

export function relativeLead(aidShieldScore: number, competitorScore: number): number {
  return aidShieldScore - competitorScore;
}
