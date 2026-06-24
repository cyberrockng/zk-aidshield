import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CONTRACT_ID,
  DISBURSEMENT_ID,
  EXPLORER_BASE,
  MERKLE_ROOT,
  VERIFIER_CONTRACT_ID,
  VK_HASH,
  shortHex,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Evidence Dossier - ZK AidShield',
  description:
    'Judge-facing evidence dossier for ZK AidShield: hackathon requirement fit, real proof anchors, threat tests, and demo verification path.',
  alternates: { canonical: '/evidence' },
};

const REQUIREMENTS = [
  {
    item: 'Open-source repo',
    evidence: 'Public source includes frontend, Soroban contracts, circuit, Merkle tooling, tests, README, threat model, and submission docs.',
    route: 'README',
  },
  {
    item: 'ZK is load-bearing',
    evidence: 'A valid Groth16 proof is required before the disbursement contract can release escrow or vendor voucher funds.',
    route: '/claim',
  },
  {
    item: 'Stellar integration',
    evidence: 'Proof verification and payout controls run through deployed Stellar testnet Soroban contracts.',
    route: '/auditor',
  },
  {
    item: 'Clear demo video path',
    evidence: 'Mission, Admin, Claim, Threats, Auditor, and Edge pages form a 2-3 minute working walkthrough.',
    route: '/mission',
  },
];

const CLAIMS = [
  ['Private eligibility', 'Beneficiary proves membership in an approved Merkle root without publishing name, ID, list index, secret, or witness.'],
  ['One-time claim', 'A wallet-bound nullifier is stored after first settlement, so replay attempts fail on-chain.'],
  ['Wrong-wallet resistance', 'Credential and proof bind claimant address into the leaf and nullifier, blocking stolen credential use from another wallet.'],
  ['Restricted voucher mode', 'The same private proof can pay an approved vendor, while vendor approval and replay controls remain public.'],
  ['Operational accountability', 'Auditors can inspect roots, contracts, escrow, claim count, vendor status, and nullifiers without seeing the private list.'],
  ['Honest demo boundary', 'The crisis mission uses synthetic actors, but points to real testnet contracts, proof assets, QR delivery, and replay controls.'],
];

const RED_TEAM = [
  ['Replay same credential', 'Blocked by persistent nullifier', 'Show the second claim attempt failing after the first success.'],
  ['Use another wallet', 'Blocked before proving and again by contract signer checks', 'Switch Freighter account and load the old credential.'],
  ['Use expired credential', 'Blocked by ledger-time expiry check', 'Credential expiry is part of the public proof statement.'],
  ['Use revoked issuer', 'Blocked by on-chain issuer registry', 'Threat page documents issuer compromise playbook.'],
  ['Redeem to unapproved vendor', 'Blocked by vendor registry', 'Voucher mode only pays approved vendor addresses.'],
  ['Pause during incident', 'Claims stop while pause is active', 'Threat dashboard makes emergency posture visible.'],
];

const VERIFY_PATH = [
  'Open Mission and state that actors are synthetic testnet labels.',
  'Open Admin and issue or show an encrypted QR credential for the beneficiary wallet.',
  'Open Claim, load/decrypt the credential, generate the browser Groth16 proof, and submit with Freighter.',
  'Open Stellar Explorer from the receipt to show settlement against the deployed contract.',
  'Retry the same credential to show replay failure.',
  'Open Auditor and Evidence to show aggregate accountability and exact verification anchors.',
];

const ANCHORS = [
  ['Disbursement contract', shortHex(CONTRACT_ID), `${EXPLORER_BASE}/contract/${CONTRACT_ID}`],
  ['Groth16 verifier', shortHex(VERIFIER_CONTRACT_ID), `${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}`],
  ['Disbursement ID', shortHex(DISBURSEMENT_ID), ''],
  ['Merkle root', shortHex(MERKLE_ROOT), ''],
  ['VK hash', `${VK_HASH.slice(0, 12)}...${VK_HASH.slice(-8)}`, ''],
];

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export default function EvidencePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div style={{ maxWidth: 820 }}>
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="badge badge-green">Submission evidence</span>
              <span className="badge badge-blue">ZK + Stellar</span>
              <span className="badge badge-amber">Judge verification path</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: 0 }}>
              Evidence Dossier
            </h1>
            <p className="text-base md:text-lg" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              A compact proof package for judges: what the hackathon requires, what AidShield actually proves,
              where the deployed Stellar contracts live, how the attacks fail, and what is intentionally synthetic.
            </p>
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: 190 }}>
            <Link href="/mission" className="btn-primary text-sm">Open Mission</Link>
            <Link href="/claim" className="btn-outline text-sm">Run Claim</Link>
            <Link href="/auditor" className="btn-outline text-sm">Audit Anchors</Link>
            <Link href="/threats" className="btn-outline text-sm">Threat Controls</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <EvidenceMetric label="Hackathon fit" value="Complete" />
        <EvidenceMetric label="ZK role" value="Load-bearing" />
        <EvidenceMetric label="Chain path" value="Soroban" />
        <EvidenceMetric label="Demo truth" value="Synthetic labels" />
      </section>

      <section className="card mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Requirement Match</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              This is the shortest way to show that the submission meets the stated Stellar Hacks: Real-World ZK rules.
            </p>
          </div>
          <Link href="/judges" className="btn-outline text-sm">Open Judge Brief</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REQUIREMENTS.map((row) => (
            <div key={row.item} className="threat-sim-row">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="font-semibold">{row.item}</div>
                <span className="badge badge-green">Met</span>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{row.evidence}</p>
              <div className="mono text-xs" style={{ color: 'var(--blue)' }}>{row.route}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Claims Judges Can Verify</h2>
          <div className="space-y-3">
            {CLAIMS.map(([title, body]) => (
              <div key={title} className="disclosure-row">
                <div className="font-semibold mb-1">{title}</div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold text-lg mb-4">Verification Anchors</h2>
          <div className="space-y-2">
            {ANCHORS.map(([label, value, href]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="mono text-xs underline text-right" style={{ color: 'var(--green)', wordBreak: 'break-all' }}>
                    {value} ↗
                  </a>
                ) : (
                  <span className="mono text-xs text-right" style={{ wordBreak: 'break-all' }}>{value}</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-5 p-4 rounded-lg" style={{ background: '#111820', border: '1px solid var(--border-dim)' }}>
            <div className="font-semibold mb-2" style={{ color: 'var(--amber)' }}>Honesty boundary</div>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              The crisis-aid names and actors are synthetic demo labels. The deployed contracts, proof statement,
              escrow flow, QR credential mechanics, replay protection, and public audit surfaces are the real testnet work.
            </p>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Red-Team Demo Matrix</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              The project is stronger when judges see failure paths, not only a happy path.
            </p>
          </div>
          <Link href="/threats" className="btn-outline text-sm">Open Threat Dashboard</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="edge-table">
            <thead>
              <tr>
                <th>Attempt</th>
                <th>Expected Result</th>
                <th>How To Show It</th>
              </tr>
            </thead>
            <tbody>
              {RED_TEAM.map(([attempt, result, demo]) => (
                <tr key={attempt}>
                  <td>{attempt}</td>
                  <td>{result}</td>
                  <td>{demo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Strongest 2-3 Minute Walkthrough</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              This sequence keeps the video focused on working product evidence.
            </p>
          </div>
          <span className="badge badge-blue">Video-ready</span>
        </div>
        <div className="pipeline">
          {VERIFY_PATH.map((step, index) => (
            <div key={step} className="pipeline-node">
              <div className="mono text-xs mb-2" style={{ color: 'var(--amber)' }}>
                {String(index + 1).padStart(2, '0')}
              </div>
              <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/mission" className="btn-primary">Start Mission Demo</Link>
        <Link href="/judges" className="btn-outline">Judge Brief</Link>
        <Link href="/edge" className="btn-outline">Competitive Edge</Link>
        <Link href="/auditor" className="btn-outline">Auditor View</Link>
      </section>
    </div>
  );
}
