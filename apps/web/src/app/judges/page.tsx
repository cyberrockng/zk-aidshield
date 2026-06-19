import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CONTRACT_ID,
  VERIFIER_CONTRACT_ID,
  EXPLORER_BASE,
  DISBURSEMENT_ID,
  MERKLE_ROOT,
  VK_HASH,
  shortHex,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Judge Brief — ZK AidShield',
  description: 'Concise judge-facing brief for ZK AidShield: why it matters, what is real, and what comes next.',
};

const PROOF_POINTS = [
  ['Private eligibility', 'Beneficiary proves membership in an approved Merkle set without revealing name, ID, or list position.'],
  ['Wallet-bound leaf', 'The leaf is Poseidon(secret, disbursement_id, claimant_address, expires_at, issuer_key_id), so stolen credentials cannot be reused from another wallet or extended past policy.'],
  ['Replay resistance', 'Nullifier is Poseidon(secret, disbursement_id, claimant_address, 1) and is persisted on-chain after the first claim.'],
  ['Real settlement', 'The contract transfers XLM from escrow through the Stellar Asset Contract after proof verification.'],
];

const DIFFERENTIATORS = [
  'End-to-end flow: operator issuance, local proof, wallet signature, Soroban verification, XLM payout.',
  'Mobile QR credential delivery: field officers can issue a signed credential QR and beneficiaries can import it on the claim page.',
  'Not an identity wallet: identity checks stay off-chain; final claim is anonymous on-chain.',
  'Not only a demo circuit: deployed contracts, test coverage, audit page, stats page, and replay/wrong-wallet demos.',
  'Stellar-native: uses Soroban and BLS12-381 pairing host functions instead of off-chain verification.',
];

const NEXT_STEPS = [
  ['Multi-issuer operations', 'Add threshold admin controls, per-issuer issuance limits, and a durable non-PII issuance ledger.'],
  ['Multi-issuer governance', 'Support field-officer issuer keys, revocation, and per-issuer limits for NGO operations.'],
  ['Vendor/voucher mode', 'Support restricted relief budgets where approved vendors can redeem without exposing beneficiary identity.'],
  ['Optional identity adapters', 'Use Human Passport or Self/OpenPassport during enrollment while keeping the payout claim anonymous.'],
];

function FactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <div className="text-xs uppercase font-semibold mb-2" style={{ color: 'var(--muted)', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div className="font-semibold leading-snug">{value}</div>
    </div>
  );
}

export default function JudgesPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <section className="mb-10">
        <div className="flex flex-wrap gap-3 mb-6">
          <span className="badge badge-green"><span className="live-dot" />Live testnet contracts</span>
          <span className="badge badge-blue">Groth16 · BLS12-381</span>
          <span className="badge badge-amber">No PII on-chain</span>
        </div>
        <h1 className="text-4xl font-extrabold mb-4" style={{ letterSpacing: '-0.02em' }}>
          Judge Brief
        </h1>
        <p className="text-lg max-w-3xl" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          ZK AidShield is a privacy-preserving humanitarian payout rail. A beneficiary proves they are eligible
          and have not claimed before, while Stellar releases aid from escrow without publishing their identity.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <FactCard label="Proof size" value="384 bytes" />
        <FactCard label="Public inputs" value="6 field elements" />
        <FactCard label="Claim scope" value="1 payout per nullifier" />
        <FactCard label="Current capacity" value="256 slots per campaign" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">What Is Real</h2>
          <div className="space-y-4">
            {PROOF_POINTS.map(([title, body]) => (
              <div key={title} className="pb-4" style={{ borderBottom: '1px solid var(--border-dim)' }}>
                <div className="font-semibold mb-1">{title}</div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold text-lg mb-4">Why It Can Lead</h2>
          <ul className="space-y-3">
            {DIFFERENTIATORS.map((item) => (
              <li key={item} className="text-sm flex gap-3" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--green-bright)', flexShrink: 0 }}>✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-4">Verification Anchors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          {[
            ['Disbursement contract', shortHex(CONTRACT_ID), `${EXPLORER_BASE}/contract/${CONTRACT_ID}`],
            ['Groth16 verifier', shortHex(VERIFIER_CONTRACT_ID), `${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}`],
            ['Disbursement ID', shortHex(DISBURSEMENT_ID), ''],
            ['Merkle root', shortHex(MERKLE_ROOT), ''],
            ['VK hash', `${VK_HASH.slice(0, 12)}…${VK_HASH.slice(-8)}`, ''],
          ].map(([label, value, href]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
              {href ? (
                <a className="mono text-xs underline text-right" style={{ color: 'var(--green)', wordBreak: 'break-all' }} href={href} target="_blank" rel="noopener noreferrer">
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
        <h2 className="font-bold text-lg mb-4">Next Value To Add</h2>
        <div className="space-y-4">
          {NEXT_STEPS.map(([title, body], index) => (
            <div key={title} className="flex gap-4 pb-4" style={{ borderBottom: '1px solid var(--border-dim)' }}>
              <div className="mono text-xs" style={{ color: 'var(--amber)', width: 28, flexShrink: 0 }}>
                {String(index + 1).padStart(2, '0')}
              </div>
              <div>
                <div className="font-semibold mb-1">{title}</div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/claim" className="btn-primary">Run Claim Demo</Link>
        <Link href="/admin" className="btn-outline">Issue Credential</Link>
        <Link href="/stats" className="btn-outline">View Stats</Link>
        <Link href="/audit" className="btn-outline">Open Audit</Link>
      </section>
    </div>
  );
}
