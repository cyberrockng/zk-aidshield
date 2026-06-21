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
  ['Voucher redemption', 'The same private proof can pay an approved vendor instead of the claimant wallet; the nullifier prevents spending both ways.'],
];

const DIFFERENTIATORS = [
  'End-to-end flow: operator issuance, local proof, wallet signature, Soroban verification, XLM payout.',
  'Mobile QR credential delivery: field officers can issue an encrypted credential QR; beneficiaries decrypt it locally before the same signature and wallet checks run.',
  'Restricted aid budgets: admins approve vendors on-chain, and beneficiaries can redeem privately authorized vouchers to those vendors.',
  'Operational accountability: admin can export a non-PII issuance ledger with keyed wallet identifiers, credential hashes, issuer key, expiry, and delivery mode.',
  'Beneficiary receipt: successful payout creates a local receipt with transaction hash, nullifier, amount, and campaign metadata.',
  'Honest privacy boundary: eligibility data stays private, while payout wallet, timing, amount, and nullifier remain public settlement data.',
  'Not only a demo circuit: deployed contracts, test coverage, audit page, stats page, and replay/wrong-wallet demos.',
  'Stellar-native: uses Soroban and BLS12-381 pairing host functions instead of off-chain verification.',
];

const DEMO_STEPS = [
  ['1', 'Issue', 'Open Admin, issue a wallet-bound credential, set QR passphrase, and show encrypted QR.'],
  ['2', 'Audit', 'Open the non-PII ledger: slot, wallet hash, credential hash, issuer key, delivery mode.'],
  ['3', 'Claim', 'Open Claim, enter passphrase, import QR/payload, generate the browser Groth16 proof.'],
  ['4', 'Settle', 'Approve Freighter, show Stellar transaction, claim receipt, then replay rejection.'],
];

const BUILT_NOW = [
  'Groth16 BLS12-381 proof verified on Soroban',
  'Real XLM escrow payout through Stellar SAC',
  'Wallet-, expiry-, and issuer-bound credentials',
  'Replay protection with persistent nullifiers',
  'Encrypted QR credential delivery',
  'Approved-vendor voucher redemption',
  'Threshold governor controls for sensitive admin operations',
  'Admin-protected non-PII issuance ledger and export',
  'Local beneficiary claim receipt',
  'Admin-protected credential issuance and beneficiary-slot APIs',
  'Admin, claim, stats, audit, and judge pages',
];

const NEXT_STEPS = [
  ['Per-issuer operational limits', 'Cap issuance volume per field officer and alert on unusual credential activity.'],
  ['Governor signing UX', 'Add a guided multi-party Soroban signing flow for threshold-2 operations in the browser.'],
  ['Optional identity adapters', 'Use Human Passport or Self/OpenPassport during enrollment while keeping eligibility proofs private.'],
];

const SECURITY_POSTURE = [
  ['Kept private', 'Names, IDs, beneficiary-list membership, credential secrets, Merkle witnesses, and local issuance records.'],
  ['Public by design', 'Payout wallet, timing, amount, contract IDs, Merkle root, verifier key hash, and nullifier.'],
  ['Abuse resistance', 'Operator APIs require an admin secret, ledger wallet identifiers use keyed HMACs, and replay is blocked on-chain.'],
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

      <section className="card mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div>
            <h2 className="font-bold text-lg mb-1">Demo Control Panel</h2>
            <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Follow this path to verify the product end to end in under three minutes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin" className="btn-primary text-sm">Admin</Link>
            <Link href="/claim" className="btn-outline text-sm">Claim</Link>
            <Link href="/auditor" className="btn-outline text-sm">Auditor</Link>
            <Link href="/audit" className="btn-outline text-sm">Audit</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
          {DEMO_STEPS.map(([num, title, body]) => (
            <div key={title} className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-dim)' }}>
              <div className="mono text-xs mb-2" style={{ color: 'var(--amber)' }}>{num}</div>
              <div className="font-semibold mb-1">{title}</div>
              <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-3 mono underline"
            style={{ background: '#0a1628', border: '1px solid var(--border-dim)', color: 'var(--green)', wordBreak: 'break-all' }}
          >
            Disbursement explorer: {shortHex(CONTRACT_ID)} ↗
          </a>
          <a
            href={`${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-3 mono underline"
            style={{ background: '#0a1628', border: '1px solid var(--border-dim)', color: 'var(--green)', wordBreak: 'break-all' }}
          >
            Verifier explorer: {shortHex(VERIFIER_CONTRACT_ID)} ↗
          </a>
        </div>
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
        <h2 className="font-bold text-lg mb-4">Security Posture</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SECURITY_POSTURE.map(([title, body]) => (
            <div key={title} className="rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-dim)' }}>
              <div className="font-semibold mb-2">{title}</div>
              <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-4">Built vs Next</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--green-bright)' }}>Built now</div>
            <div className="space-y-2">
              {BUILT_NOW.map((item) => (
                <div key={item} className="text-sm flex gap-3" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--green-bright)', flexShrink: 0 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--amber)' }}>Next after submission</div>
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
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/claim" className="btn-primary">Run Claim Demo</Link>
        <Link href="/admin" className="btn-outline">Issue Credential</Link>
        <Link href="/auditor" className="btn-outline">Open Auditor Dashboard</Link>
        <Link href="/audit" className="btn-outline">Open Audit</Link>
      </section>
    </div>
  );
}
