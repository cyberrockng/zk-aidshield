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

const pillars = [
  {
    title: 'Independent security review',
    status: 'Ready to request',
    body: 'Audit scope is packaged for circuits, Soroban contracts, issuance, witness handling, Redis ledger, admin controls, and frontend trust boundaries.',
    route: '/audit',
    artifact: 'docs/INDEPENDENT_AUDIT_SCOPE.md',
  },
  {
    title: 'Trusted setup path',
    status: 'Ceremony plan documented',
    body: 'Groth16 demo setup is disclosed, with a production ceremony checklist covering contributors, transcript verification, toxic-waste handling, and artifact hashes.',
    route: '/protocol',
    artifact: 'docs/TRUSTED_SETUP_PLAN.md',
  },
  {
    title: 'Real pilot package',
    status: 'Pilot-ready plan',
    body: 'Field runbook defines NGO operator, field officer, beneficiary, vendor, auditor, data-retention rules, offline QR handling, and incident escalation.',
    route: '/pilot',
    artifact: 'docs/FIELD_PILOT_RUNBOOK.md',
  },
  {
    title: 'Production issuance backend',
    status: 'Control model defined',
    body: 'Durable Redis reservations, non-PII ledger, admin auth, rate limits, issuer revocation, delivery events, and audit trails are mapped as deployable controls.',
    route: '/admin',
    artifact: 'docs/PRODUCTION_ISSUANCE_BACKEND.md',
  },
  {
    title: 'Threat actor hardening',
    status: 'Operational playbooks',
    body: 'Threat cases now include malicious operators, stolen QR credentials, compromised frontend, phishing, vendor abuse, coercion, and emergency pause.',
    route: '/threats',
    artifact: 'docs/INCIDENT_RESPONSE_PLAYBOOK.md',
  },
  {
    title: 'Privacy disclosure clarity',
    status: 'Explicit boundary',
    body: 'The project clearly separates hidden eligibility data from public settlement metadata so judges see exactly what privacy is and is not promised.',
    route: '/readiness#privacy-boundary',
    artifact: 'docs/PRIVACY_DISCLOSURE.md',
  },
  {
    title: 'Live proof evidence',
    status: 'Verification lab',
    body: 'Judges can inspect contract anchors, public proof inputs, verifier key hash, receipt verification, nullifier replay posture, and explorer links.',
    route: '/verification-lab',
    artifact: 'docs/VERIFICATION_LAB.md',
  },
];

const hidden = [
  'Beneficiary name',
  'Internal aid ID',
  'Credential secret',
  'Merkle witness/path',
  'Eligibility-list membership proof witness',
  'Issuer private key',
];

const publicData = [
  'Claimant wallet',
  'Transaction hash',
  'Payout amount',
  'Ledger timing',
  'Merkle root',
  'Nullifier',
  'Disbursement contract',
  'Verifier contract',
];

export default function ReadinessPage() {
  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-green mb-4">100%+ Readiness Board</div>
        <h1 className="text-4xl font-bold mb-3">From hackathon demo to real-world aid protocol.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          This board shows the seven production credibility layers behind AidShield: external review readiness,
          trusted setup posture, pilot operations, durable issuance, threat response, privacy boundaries, and live
          proof evidence. Some items are fully implemented; external audit and real pilot execution remain outside
          the repo and are clearly labeled as next operational actions.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/verification-lab" className="btn-primary text-sm">Open Verification Lab</Link>
          <Link href="/demo-path" className="btn-outline text-sm">Run Judge Demo</Link>
          <Link href="/threats" className="btn-outline text-sm">Threat Board</Link>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-4">
        {[
          ['Hackathon alignment', 'Complete'],
          ['ZK load bearing', 'Yes'],
          ['Production docs', '7 layers'],
          ['External actions', '3 remain'],
        ].map(([label, value]) => (
          <div key={label} className="metric-card">
            <div className="metric-label">{label}</div>
            <div className="metric-value">{value}</div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        {pillars.map((pillar) => (
          <div key={pillar.title} className="card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold">{pillar.title}</h2>
              <span className="badge badge-blue">{pillar.status}</span>
            </div>
            <p className="text-sm leading-6 mb-4" style={{ color: 'var(--muted)' }}>{pillar.body}</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Link href={pillar.route} className="btn-outline text-xs" style={{ padding: '5px 10px' }}>
                Open surface
              </Link>
              <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{pillar.artifact}</span>
            </div>
          </div>
        ))}
      </section>

      <section id="privacy-boundary" className="grid lg:grid-cols-2 gap-5">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Hidden By The ZK Flow</h2>
          <div className="space-y-2">
            {hidden.map((item) => (
              <div key={item} className="data-row">
                <span>{item}</span>
                <span className="badge badge-green">not public</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Public Settlement Metadata</h2>
          <div className="space-y-2">
            {publicData.map((item) => (
              <div key={item} className="data-row">
                <span>{item}</span>
                <span className="badge badge-amber">public</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-bold mb-4">Live Anchors</h2>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {[
            ['Disbursement', shortHex(CONTRACT_ID), `${EXPLORER_BASE}/contract/${CONTRACT_ID}`],
            ['Verifier', shortHex(VERIFIER_CONTRACT_ID), `${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}`],
            ['Disbursement ID', shortHex(DISBURSEMENT_ID), ''],
            ['Merkle root', shortHex(MERKLE_ROOT), ''],
            ['VK hash', `${VK_HASH.slice(0, 12)}...${VK_HASH.slice(-8)}`, ''],
          ].map(([label, value, href]) => (
            <div key={label} className="data-row">
              <span style={{ color: 'var(--muted)' }}>{label}</span>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="mono underline">
                  {value}
                </a>
              ) : (
                <span className="mono">{value}</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
