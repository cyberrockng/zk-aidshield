import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ADMIN_ADDRESS,
  CONTRACT_ID,
  DISBURSEMENT_ID,
  EXPLORER_BASE,
  ISSUER_KEY_ID,
  MERKLE_ROOT,
  VERIFIER_CONTRACT_ID,
  VK_HASH,
  shortHex,
} from '@/lib/constants';
import {
  AIDSHIELD_AFTER_SCORE,
  AIDSHIELD_BEFORE_SCORE,
  COMPETITIVE_PROJECTS,
  INTEGRATED_ADVANTAGES,
  growthDelta,
  relativeLead,
} from '@/lib/readiness-benchmark';

export const metadata: Metadata = {
  title: 'Competitive Edge — ZK AidShield',
  description:
    'Judge proof board, selective disclosure, telemetry, threat simulator, and competitive readiness for ZK AidShield.',
};

const PROOF_BOARD = [
  ['Valid private claim', 'Expected pass', 'Groth16 proof verifies, claimant signs, nullifier unused, escrow pays once.', 'ZK circuit + Soroban'],
  ['Replay claim', 'Expected fail', 'The same nullifier is already persisted and blocks cash-plus-voucher reuse.', 'Soroban nullifier set'],
  ['Wrong wallet', 'Expected fail', 'Credential leaf binds the claimant address field, so another wallet cannot claim it.', 'ZK public input binding'],
  ['Expired credential', 'Expected fail', 'The claim public input carries expires_at and the contract rejects stale credentials.', 'Soroban policy'],
  ['Revoked issuer', 'Expected fail', 'Issuer key id must be active before the proof can release funds.', 'Issuer registry'],
  ['Unauthorized vendor', 'Expected fail', 'Voucher route only pays active vendor addresses.', 'Vendor registry'],
  ['Emergency pause', 'Expected fail', 'Operators can pause claims during incident response without revealing beneficiary data.', 'Governance control'],
];

const DISCLOSURE_ROWS = [
  ['Donor', 'Campaign funded amount, remaining escrow, number of claims, payout size, contract ids.', 'Beneficiary name, ID, credential secret, Merkle path.'],
  ['Regulator', 'Nullifier count, approved issuer keys, vendor approval status, settlement hashes.', 'Aid-list membership and private eligibility witness.'],
  ['Field operator', 'Credential hash, keyed wallet identifier, expiry, delivery mode, issuer key id.', 'Raw identity documents and unencrypted beneficiary credential.'],
];

const TELEMETRY = [
  ['Circuit', 'aidshield-groth16 / Circom'],
  ['Curve', 'BLS12-381'],
  ['Proof size', '384 bytes'],
  ['Public inputs', '6 field elements'],
  ['Verifier contract', shortHex(VERIFIER_CONTRACT_ID)],
  ['Disbursement contract', shortHex(CONTRACT_ID)],
  ['Merkle root', shortHex(MERKLE_ROOT)],
  ['VK hash', `${VK_HASH.slice(0, 12)}...${VK_HASH.slice(-8)}`],
];

const NO_WALLET_STEPS = [
  ['Read', 'Open Judges or Edge page and inspect contract anchors without connecting a wallet.'],
  ['Issue', 'Use prepared sample credential or admin-issued QR payload from the local demo pack.'],
  ['Prove', 'Generate the browser proof and inspect proof/public-input telemetry.'],
  ['Verify', 'Show that invalid routes are rejected by tests, simulation, or replay after first claim.'],
];

const ATTACK_SIMULATOR = [
  ['Forged proof', 'Blocked', 'Verifier rejects proof that does not match the committed Merkle root.'],
  ['Credential leak', 'Blocked', 'Wallet-bound leaf prevents a different Freighter account from claiming.'],
  ['Double spend', 'Blocked', 'Nullifier prevents cash and vendor routes from both succeeding.'],
  ['Compromised vendor', 'Contained', 'Admin can revoke vendor and keep direct cash route available.'],
  ['Compromised issuer', 'Contained', 'Issuer key can be revoked and campaign can be rotated.'],
  ['Underfunded campaign', 'Visible', 'Escrow health and remaining claim capacity are visible to auditors.'],
];

function ScoreCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}

export default function CompetitiveEdgePage() {
  const delta = growthDelta(AIDSHIELD_BEFORE_SCORE, AIDSHIELD_AFTER_SCORE);

  return (
    <div className="max-w-6xl mx-auto">
      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div style={{ maxWidth: 800 }}>
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="badge badge-green">Integrated recommendations</span>
              <span className="badge badge-blue">Judge-ready proof board</span>
              <span className="badge badge-amber">Threat-aware aid privacy</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: 0 }}>
              Competitive Edge Package
            </h1>
            <p className="text-base md:text-lg" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              This page packages the strongest ideas from current public Stellar ZK projects into AidShield’s own lane:
              private humanitarian aid claims with accountable donors, vendors, issuers, and incident controls.
            </p>
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: 190 }}>
            <Link href="/judges" className="btn-primary text-sm">Judge Brief</Link>
            <Link href="/mission" className="btn-outline text-sm">Mission Demo</Link>
            <Link href="/threats" className="btn-outline text-sm">Threat Controls</Link>
            <Link href="/claim" className="btn-outline text-sm">Run Claim</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <ScoreCard label="AidShield before" value={`${AIDSHIELD_BEFORE_SCORE}%`} />
        <ScoreCard label="AidShield after" value={`${AIDSHIELD_AFTER_SCORE}%`} tone="var(--green-bright)" />
        <ScoreCard label="Readiness growth" value={`+${delta}%`} tone="var(--green-bright)" />
        <ScoreCard label="Current lead range" value="+5% to +14%" tone="var(--blue)" />
      </section>

      <section className="card mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div style={{ maxWidth: 780 }}>
            <div className="badge badge-green mb-4">New judge story layer</div>
            <h2 className="font-bold text-lg mb-2">Crisis Aid Mission Demo</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              AidShield now has a clearly labeled synthetic flood-relief mission: NGO operator issues an encrypted QR,
              beneficiary claims privately, approved vendor can receive voucher payment, replay fails, and donors audit
              aggregate settlement without seeing PII. This keeps the demo honest while making the real-world use case concrete.
            </p>
          </div>
          <Link href="/mission" className="btn-primary text-sm">Open Mission</Link>
        </div>
      </section>

      <section className="card mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Judge Proof Board</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              A compact view of what succeeds and what must fail before a reviewer trusts the system.
            </p>
          </div>
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm"
          >
            Open Contract
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="edge-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Result</th>
                <th>Evidence</th>
                <th>Layer</th>
              </tr>
            </thead>
            <tbody>
              {PROOF_BOARD.map(([name, result, evidence, layer]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    <span className={result.includes('pass') ? 'badge badge-green' : 'badge badge-amber'}>
                      {result}
                    </span>
                  </td>
                  <td>{evidence}</td>
                  <td className="mono">{layer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Selective Disclosure Panel</h2>
          <div className="space-y-4">
            {DISCLOSURE_ROWS.map(([viewer, shown, hidden]) => (
              <div key={viewer} className="disclosure-row">
                <div className="font-semibold mb-2">{viewer}</div>
                <p className="text-sm mb-2" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>
                  <span style={{ color: 'var(--green-bright)' }}>Shown:</span> {shown}
                </p>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>
                  <span style={{ color: 'var(--amber)' }}>Hidden:</span> {hidden}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold text-lg mb-4">Proof Telemetry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 text-sm">
            {TELEMETRY.map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="mono text-right" style={{ wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 p-4 rounded-lg" style={{ background: '#111820', border: '1px solid var(--border-dim)' }}>
            <div className="font-semibold mb-2">Verification anchor</div>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Disbursement <span className="mono">{shortHex(DISBURSEMENT_ID)}</span> uses issuer key{' '}
              <span className="mono">{shortHex(ISSUER_KEY_ID)}</span> and admin anchor{' '}
              <span className="mono">{shortHex(ADMIN_ADDRESS)}</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">No-Wallet Judge Mode</h2>
          <div className="space-y-3">
            {NO_WALLET_STEPS.map(([title, body], index) => (
              <div key={title} className="flex gap-4 p-3 rounded-lg" style={{ background: '#111820', border: '1px solid var(--border-dim)' }}>
                <div className="mono text-xs" style={{ color: 'var(--blue)', width: 28 }}>{String(index + 1).padStart(2, '0')}</div>
                <div>
                  <div className="font-semibold mb-1">{title}</div>
                  <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold text-lg mb-4">Threat Simulator</h2>
          <div className="space-y-3">
            {ATTACK_SIMULATOR.map(([attack, status, body]) => (
              <div key={attack} className="threat-sim-row">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-semibold">{attack}</div>
                  <span className={status === 'Blocked' ? 'badge badge-green' : status === 'Contained' ? 'badge badge-blue' : 'badge badge-amber'}>
                    {status}
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-4">Integrated Advantages</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {INTEGRATED_ADVANTAGES.map((item) => (
            <div key={item} className="flex gap-3 p-3 rounded-lg" style={{ background: '#111820', border: '1px solid var(--border-dim)' }}>
              <span style={{ color: 'var(--green-bright)', flexShrink: 0 }}>✓</span>
              <span className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-4">Competitive Readiness Growth</h2>
        <div className="overflow-x-auto">
          <table className="edge-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Focus</th>
                <th>Before</th>
                <th>After AidShield Edge</th>
                <th>AidShield Lead</th>
                <th>What changed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>ZK AidShield</td>
                <td>Private humanitarian aid claims</td>
                <td>{AIDSHIELD_BEFORE_SCORE}%</td>
                <td>{AIDSHIELD_AFTER_SCORE}%</td>
                <td className="mono" style={{ color: 'var(--green-bright)' }}>+{delta}% internal growth</td>
                <td>Recommendations are now packaged as visible product surfaces.</td>
              </tr>
              {COMPETITIVE_PROJECTS.map((project) => (
                <tr key={project.name}>
                  <td>{project.name}</td>
                  <td>{project.focus}</td>
                  <td>{project.before}%</td>
                  <td>{project.after}%</td>
                  <td className="mono" style={{ color: 'var(--green-bright)' }}>
                    +{relativeLead(AIDSHIELD_AFTER_SCORE, project.after)}%
                  </td>
                  <td>{project.gapClosed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-4" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
          These percentages are strategic readiness estimates, not official hackathon scores. They measure clarity,
          real-world fit, ZK load-bearing value, Stellar integration, demoability, and threat posture.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/judges" className="btn-primary">Open Judge Brief</Link>
        <Link href="/mission" className="btn-outline">Open Mission Demo</Link>
        <Link href="/threats" className="btn-outline">Open Threat Dashboard</Link>
        <Link href="/audit" className="btn-outline">Open Audit Evidence</Link>
      </section>
    </div>
  );
}
