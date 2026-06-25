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
  title: 'Crisis Aid Mission Demo — ZK AidShield',
  description:
    'Synthetic testnet mission showing NGO issuance, beneficiary private claim, vendor voucher redemption, replay rejection, and donor audit visibility.',
  alternates: { canonical: '/mission' },
};

const ACTORS = [
  {
    role: 'NGO operator',
    name: 'Relief coordinator',
    action: 'Issues encrypted QR credentials and manages issuer, vendor, pause, and escrow controls.',
    privateData: 'Beneficiary names, IDs, and eligibility list stay off-chain.',
  },
  {
    role: 'Beneficiary',
    name: 'Approved household wallet',
    action: 'Decrypts credential locally, generates a Groth16 proof, signs with Freighter, and claims once.',
    privateData: 'Secret and Merkle witness are used locally during claim; aid-list membership is not sent on-chain or to the verifier.',
  },
  {
    role: 'Approved vendor',
    name: 'Medical supply point',
    action: 'Receives voucher payout only if the beneficiary authorizes a valid private eligibility proof.',
    privateData: 'Vendor sees settlement, not the private eligibility witness or full beneficiary list.',
  },
];

const MISSION_FLOW = [
  ['01', 'Create campaign', 'Operator commits the synthetic flood-relief eligibility set as a Merkle root on Soroban.'],
  ['02', 'Issue QR credential', 'Field officer gives the beneficiary an encrypted QR credential bound to that wallet, expiry, issuer, and campaign.'],
  ['03', 'Private claim', 'Beneficiary decrypts locally, generates a 384-byte Groth16 proof, and submits it with a Freighter signature.'],
  ['04', 'Choose payout route', 'The same proof can release direct cash or pay an approved medical vendor; the nullifier prevents using both.'],
  ['05', 'Replay fails', 'A second attempt with the same credential is blocked because the nullifier is already stored on-chain.'],
  ['06', 'Donor audit', 'Auditors inspect escrow, claim count, vendor status, contract IDs, and nullifiers without seeing PII.'],
];

const WHAT_IS_REAL = [
  ['Real', 'Stellar testnet escrow, deployed Soroban contracts, Groth16 verifier, wallet-bound proof, nullifier replay block.'],
  ['Real', 'Admin-protected credential issuance, encrypted QR payloads, approved vendor registry, non-PII issuance ledger.'],
  ['Synthetic', 'Flood-relief campaign name, field officer, household, and vendor labels are demo personas for judging clarity.'],
  ['Not claimed', 'No real NGO partnership, real beneficiary identity, or real-world aid distribution is represented by this demo.'],
];

const EVIDENCE = [
  ['Eligibility privacy', 'No beneficiary name, ID, raw credential secret, or Merkle path is published on-chain.'],
  ['Accountability', 'Campaign root, verifier, disbursement contract, escrow, claim count, and settlement hashes are public.'],
  ['Threat resistance', 'Wrong wallet, replay, revoked issuer, unauthorized vendor, and emergency pause are demonstrable failure paths.'],
  ['Field readiness', 'Encrypted QR delivery supports phone-first or paper handoff without changing the proof statement.'],
];

const RECORDING_BEATS = [
  'Open this Mission page and state that it is a synthetic testnet flood-relief scenario.',
  'Open Admin and issue an encrypted QR credential to the beneficiary test wallet.',
  'Open Claim, decrypt/load the credential, generate the proof, and choose cash or vendor voucher.',
  'Approve Freighter and show the Stellar Explorer transaction.',
  'Retry the same credential and show the replay rejection.',
  'Open Auditor, Threats, and Edge to show aggregate accountability without beneficiary exposure.',
];

const IMPACT_METRICS = [
  ['Escrow funded', '50 XLM'],
  ['Payout size', '1 XLM'],
  ['Eligible slots', '256'],
  ['PII exposed', '0'],
  ['Claim routes', 'Cash + voucher'],
  ['Replay design', 'Single-use nullifier'],
];

function MissionCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export default function MissionPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div style={{ maxWidth: 820 }}>
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="badge badge-green">Synthetic testnet mission</span>
              <span className="badge badge-blue">Flood relief scenario</span>
              <span className="badge badge-amber">No real PII</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: 0 }}>
              Crisis Aid Mission Demo
            </h1>
            <p className="text-base md:text-lg" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              A judge-ready story for ZK AidShield: a flood-relief NGO issues an encrypted credential,
              an approved household claims privately, an approved medical vendor can receive voucher payment,
              replay fails, and donors audit aggregate settlement without seeing beneficiary identity.
            </p>
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: 190 }}>
            <Link href="/admin" className="btn-primary text-sm">Start At Admin</Link>
            <Link href="/claim" className="btn-outline text-sm">Run Claim</Link>
            <Link href="/auditor" className="btn-outline text-sm">Audit View</Link>
            <Link href="/evidence" className="btn-outline text-sm">Evidence Dossier</Link>
            <Link href="/protocol" className="btn-outline text-sm">Protocol Fit</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MissionCard label="Mission type" value="Flood relief" />
        <MissionCard label="Actors" value="3 roles" />
        <MissionCard label="Claim route" value="Cash or voucher" />
        <MissionCard label="Truth status" value="Synthetic demo" />
      </section>

      <section className="card mb-8" style={{ borderColor: 'rgba(227,179,65,0.35)' }}>
        <div className="font-bold text-lg mb-2">Honesty Boundary</div>
        <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          This mission uses synthetic beneficiaries, a simulated field officer, and a representative approved vendor.
          The proof system, Stellar testnet contracts, escrow accounting, QR credential flow, vendor controls, and replay
          rejection are real demo mechanics. The scenario is not a claim of a live NGO deployment.
        </p>
      </section>

      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Crisis Mission Impact Dashboard</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Demo-facing impact numbers that keep the story concrete without claiming a real deployment.
            </p>
          </div>
          <span className="badge badge-green">Judge visible</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {IMPACT_METRICS.map(([label, value]) => (
            <MissionCard key={label} label={label} value={value} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {ACTORS.map((actor) => (
          <div key={actor.role} className="card">
            <div className="badge badge-blue mb-4">{actor.role}</div>
            <h2 className="font-bold text-lg mb-2">{actor.name}</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{actor.action}</p>
            <div className="text-xs p-3 rounded-lg" style={{ background: '#111820', border: '1px solid var(--border-dim)', color: 'var(--muted)', lineHeight: 1.55 }}>
              <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Privacy boundary:</span> {actor.privateData}
            </div>
          </div>
        ))}
      </section>

      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Mission Flow</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              The full demo path from field issuance to donor accountability.
            </p>
          </div>
          <span className="badge badge-green">End to end</span>
        </div>
        <div className="pipeline">
          {MISSION_FLOW.map(([num, title, body]) => (
            <div key={title} className="pipeline-node">
              <div className="mono text-xs mb-2" style={{ color: 'var(--amber)' }}>{num}</div>
              <div className="font-semibold mb-2">{title}</div>
              <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Real vs Synthetic</h2>
          <div className="space-y-3">
            {WHAT_IS_REAL.map(([type, body]) => (
              <div key={`${type}-${body}`} className="disclosure-row">
                <div className="font-semibold mb-1" style={{ color: type === 'Synthetic' || type === 'Not claimed' ? 'var(--amber)' : 'var(--green-bright)' }}>
                  {type}
                </div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold text-lg mb-4">Evidence Judges Can Verify</h2>
          <div className="space-y-3">
            {EVIDENCE.map(([title, body]) => (
              <div key={title} className="threat-sim-row">
                <div className="font-semibold mb-1">{title}</div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Contract Anchors</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              The mission story points at the same deployed testnet stack used by the rest of AidShield.
            </p>
          </div>
          <Link href="/edge" className="btn-outline text-sm">Open Edge Board</Link>
          <Link href="/evidence" className="btn-outline text-sm">Open Evidence</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 text-sm">
          {[
            ['Disbursement contract', shortHex(CONTRACT_ID), `${EXPLORER_BASE}/contract/${CONTRACT_ID}`],
            ['Groth16 verifier', shortHex(VERIFIER_CONTRACT_ID), `${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}`],
            ['Disbursement ID', shortHex(DISBURSEMENT_ID), ''],
            ['Merkle root', shortHex(MERKLE_ROOT), ''],
            ['VK hash', `${VK_HASH.slice(0, 12)}...${VK_HASH.slice(-8)}`, ''],
          ].map(([label, value, href]) => (
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
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-4">Recording Beats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RECORDING_BEATS.map((beat, index) => (
            <div key={beat} className="flex gap-4 p-3 rounded-lg" style={{ background: '#111820', border: '1px solid var(--border-dim)' }}>
              <div className="mono text-xs" style={{ color: 'var(--blue)', width: 28 }}>{String(index + 1).padStart(2, '0')}</div>
              <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{beat}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/admin" className="btn-primary">Issue Credential</Link>
        <Link href="/claim" className="btn-outline">Claim Privately</Link>
        <Link href="/auditor" className="btn-outline">Show Donor Audit</Link>
        <Link href="/threats" className="btn-outline">Show Failed Attacks</Link>
        <Link href="/evidence" className="btn-outline">Show Evidence Dossier</Link>
        <Link href="/judge-mode" className="btn-outline">Judge Mode</Link>
      </section>
    </div>
  );
}
