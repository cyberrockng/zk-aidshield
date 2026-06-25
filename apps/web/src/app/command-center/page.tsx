'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { fetchStats, type CampaignStats } from '@/lib/soroban';
import {
  CONTRACT_ID,
  DISBURSEMENT_ID,
  EXPLORER_BASE,
  ISSUER_KEY_ID,
  ISSUER_PUBLIC_KEY,
  MERKLE_ROOT,
  VERIFIER_CONTRACT_ID,
  VK_HASH,
  shortHex,
  stroopsToXlm,
} from '@/lib/constants';

const workflow = [
  ['01', 'Donor funds', 'Public donors add XLM to escrow and receive proof-of-impact receipts.'],
  ['02', 'Build campaign', 'Prepare local beneficiary CSV/config and generate a wallet-bound Merkle root.'],
  ['03', 'Issue claim pass', 'Operator signs a private credential and delivers it as JSON or encrypted QR.'],
  ['04', 'Private claim', 'Beneficiary proves eligibility locally and submits a 384-byte Groth16 proof to Soroban.'],
  ['05', 'Public audit', 'Donors inspect escrow, nullifiers, root, verifier, receipt, and impact without PII.'],
];

const controls = [
  ['Proof system', 'Groth16 BLS12-381', 'Browser snarkjs proof, Soroban pairing verification.'],
  ['Durable issuance', 'Upstash Redis enabled', 'Credential slots and wallet hashes are reserved with SET NX.'],
  ['Replay defense', 'On-chain nullifier', 'Cash and voucher routes share replay protection.'],
  ['Issuer posture', 'Rotated active issuer', 'Old issuer revoked; current key ID is visible for auditors.'],
  ['Production boundary', 'Ceremony documented', 'Trusted setup plan and external review issue are public.'],
];

const quickLinks = [
  ['/campaign-builder', 'Campaign Builder', 'Prepare local campaign input'],
  ['/donor', 'Donor Escrow', 'Fund aid and receive impact receipt'],
  ['/admin', 'Operator Console', 'Issue credentials and QR passes'],
  ['/claim-pass', 'Claim Pass', 'Generate beneficiary delivery card'],
  ['/claim', 'Claim Flow', 'Prove and settle on Stellar'],
  ['/receipt', 'Proof Receipt', 'Inspect claim receipt JSON'],
  ['/auditor', 'Auditor Portal', 'Live public campaign state'],
  ['/impact', 'Impact Dashboard', 'Privacy and payout metrics'],
  ['/threats', 'Threat Board', 'Show blocked abuse paths'],
];

export default function CommandCenterPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetchStats()
      .then((next) => {
        setStats(next);
        setUpdatedAt(new Date());
      })
      .catch(() => {});
  }, []);

  const remainingClaims = useMemo(() => {
    if (!stats || stats.payout_amount === 0n) return null;
    return Math.floor(Number(stats.escrow_balance / stats.payout_amount));
  }, [stats]);

  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="badge badge-green mb-4">AidShield Command Center</div>
            <h1 className="text-4xl font-bold mb-3">Private aid claims. Public impact proof.</h1>
            <p className="text-sm leading-7" style={{ color: 'var(--muted-2)' }}>
              A judge-facing operations hub for the whole crisis-aid loop: campaign prep, private claim pass delivery,
              browser ZK proving, Stellar settlement, replay resistance, and public audit evidence.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 min-w-[280px]">
            <div className="metric-card">
              <div className="metric-label">Escrow</div>
              <div className="metric-value">{stats ? `${stroopsToXlm(stats.escrow_balance)} XLM` : 'Loading'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Claims paid</div>
              <div className="metric-value">{stats ? stats.claimed_count : '...'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Remaining</div>
              <div className="metric-value">{remainingClaims ?? '...'}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Proof size</div>
              <div className="metric-value">384 B</div>
            </div>
          </div>
        </div>
        {updatedAt && (
          <div className="mt-4 text-xs" style={{ color: 'var(--muted)' }}>
            Live contract data refreshed {updatedAt.toLocaleTimeString()}
          </div>
        )}
      </section>

      <section className="pipeline">
        {workflow.map(([step, title, body]) => (
          <div key={step} className="pipeline-node">
            <div className="badge badge-blue mb-3">{step}</div>
            <div className="font-semibold mb-2">{title}</div>
            <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>{body}</p>
          </div>
        ))}
      </section>

      <section className="grid md:grid-cols-2 gap-5">
        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold">Verifier Status</h2>
            <span className="badge badge-green">Consistent</span>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ['Proof system', 'Groth16 BLS12-381'],
              ['Verifier mode', 'Full Soroban pairing verification'],
              ['Proof bytes', '384-byte pi_a || pi_b || pi_c'],
              ['Circuit', 'circom 2.1 + snarkjs'],
              ['VK hash', shortHex(VK_HASH)],
            ].map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="mono text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold">Public Anchors</h2>
            <a
              href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline text-xs"
              style={{ padding: '5px 10px' }}
            >
              Explorer
            </a>
          </div>
          <div className="space-y-3 text-sm">
            {[
              ['Disbursement', shortHex(CONTRACT_ID)],
              ['Verifier', shortHex(VERIFIER_CONTRACT_ID)],
              ['Merkle root', shortHex(MERKLE_ROOT)],
              ['Disbursement ID', shortHex(DISBURSEMENT_ID)],
              ['Issuer key', shortHex(ISSUER_PUBLIC_KEY)],
              ['Issuer ID', shortHex(ISSUER_KEY_ID)],
            ].map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="mono text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-5 gap-4">
        {controls.map(([label, value, body]) => (
          <div key={label} className="privacy-panel">
            <div className="metric-label mb-2">{label}</div>
            <div className="font-semibold mb-2" style={{ color: 'var(--green-bright)' }}>{value}</div>
            <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>{body}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="text-xl font-bold mb-4">Operator And Judge Shortcuts</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickLinks.map(([href, label, body]) => (
            <Link key={href} href={href} className="route-card hover:border-green-500 transition-colors">
              <div className="font-semibold mb-2">{label}</div>
              <div className="text-xs leading-5" style={{ color: 'var(--muted)' }}>{body}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
