import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Field Pilot Readiness - ZK AidShield',
  description: 'Honest field-pilot plan for moving ZK AidShield from hackathon demo to NGO deployment readiness.',
  alternates: { canonical: '/pilot' },
};

const WORKFLOWS = [
  ['NGO operator', 'Creates campaign, funds escrow, approves issuers/vendors, pauses incidents, exports non-PII ledger.'],
  ['Field officer', 'Issues encrypted QR credential to approved wallet after local intake and policy checks.'],
  ['Beneficiary', 'Stores QR/payload, proves eligibility locally, claims cash or redeems voucher once.'],
  ['Vendor', 'Receives voucher payout only when approved and when the beneficiary proof is valid.'],
  ['Donor/auditor', 'Reviews escrow, claim count, nullifiers, settlement events, and privacy boundary.'],
];

const PRODUCTION_GAPS = [
  ['Public trusted setup', 'Run a multi-party ceremony or migrate to a setup model acceptable to partners.'],
  ['Independent audit', 'Review circuit, verifier key encoding, Soroban contracts, and frontend threat model.'],
  ['Partner pilot', 'Validate workflow with an NGO advisor or small field simulation before real deployment.'],
  ['Mobile hardening', 'Test QR import/export, offline handoff, passphrase recovery, and low-end Android proving constraints.'],
  ['Data governance', 'Define retention rules for local issuance logs, keyed identifiers, and incident response records.'],
];

export default function PilotPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div style={{ maxWidth: 820 }}>
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="badge badge-green">Hackathon to field</span>
              <span className="badge badge-blue">Operational workflow</span>
              <span className="badge badge-amber">Honest production gaps</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: 0 }}>
              Field Pilot Readiness
            </h1>
            <p className="text-base md:text-lg" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              This is the path from a strong hackathon demo to a credible crisis-aid pilot:
              preserve the ZK settlement core, harden operations, and be honest about what needs audit.
            </p>
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: 190 }}>
            <Link href="/mission" className="btn-primary text-sm">Mission Demo</Link>
            <Link href="/protocol" className="btn-outline text-sm">Protocol Fit</Link>
            <Link href="/threats" className="btn-outline text-sm">Threat Controls</Link>
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-4">Pilot Workflows</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {WORKFLOWS.map(([role, body]) => (
            <div key={role} className="disclosure-row">
              <div className="font-semibold mb-1">{role}</div>
              <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-4">Production Gaps We Are Not Hiding</h2>
        <div className="space-y-3">
          {PRODUCTION_GAPS.map(([title, body], index) => (
            <div key={title} className="flex gap-4 p-3 rounded-lg" style={{ background: '#111820', border: '1px solid var(--border-dim)' }}>
              <div className="mono text-xs" style={{ color: 'var(--amber)', width: 28 }}>{String(index + 1).padStart(2, '0')}</div>
              <div>
                <div className="font-semibold mb-1">{title}</div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-panel">
        <h2 className="font-bold text-lg mb-3">Why This Makes The Submission Stronger</h2>
        <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          It shows ambition without pretending the demo is a real aid deployment. Judges see a working
          ZK + Stellar core today and a practical route toward field validation after the hackathon.
        </p>
      </section>
    </div>
  );
}
