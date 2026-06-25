'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchStats, type CampaignStats } from '@/lib/soroban';
import { CONTRACT_ID, EXPLORER_BASE, MERKLE_ROOT, VK_HASH, shortHex, stroopsToXlm } from '@/lib/constants';

const privacyCounters = [
  ['Names published on-chain', '0'],
  ['IDs published on-chain', '0'],
  ['Credential witnesses sent to verifier', '0'],
  ['Replay path', 'Blocked by nullifier'],
];

export default function ImpactPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
  }, []);

  const model = useMemo(() => {
    if (!stats) return null;
    const paid = BigInt(stats.claimed_count) * stats.payout_amount;
    const total = paid + stats.escrow_balance;
    const remaining = stats.payout_amount > 0n ? stats.escrow_balance / stats.payout_amount : 0n;
    const utilization = total > 0n ? Number((paid * 10_000n) / total) / 100 : 0;
    return { paid, total, remaining, utilization };
  }, [stats]);

  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-green mb-4">Privacy Impact Dashboard</div>
        <h1 className="text-4xl font-bold mb-3">Public outcomes without beneficiary exposure.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          This page turns the ZK mechanics into humanitarian impact evidence: escrow, payout capacity, claims paid,
          and privacy counters that stay meaningful without publishing names, IDs, or eligibility lists.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="metric-card">
          <div className="metric-label">Escrowed now</div>
          <div className="metric-value">{stats ? `${stroopsToXlm(stats.escrow_balance)} XLM` : 'Loading'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Paid privately</div>
          <div className="metric-value">{model ? `${stroopsToXlm(model.paid)} XLM` : '...'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Claims paid</div>
          <div className="metric-value">{stats ? stats.claimed_count : '...'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Claims remaining</div>
          <div className="metric-value">{model ? model.remaining.toString() : '...'}</div>
        </div>
      </section>

      <section className="card">
        <div className="flex justify-between text-sm mb-3">
          <span className="font-semibold">Escrow utilization</span>
          <span style={{ color: 'var(--muted)' }}>{model ? `${model.utilization.toFixed(2)}%` : 'Loading'}</span>
        </div>
        <div style={{ height: 12, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(model?.utilization ?? 0, 100)}%`,
              height: '100%',
              background: 'var(--green)',
              borderRadius: 999,
            }}
          />
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-5">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Privacy Counters</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {privacyCounters.map(([label, value]) => (
              <div key={label} className="privacy-panel">
                <div className="metric-label mb-2">{label}</div>
                <div className="font-semibold" style={{ color: 'var(--green-bright)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Audit Anchors</h2>
          <div className="space-y-3 text-sm">
            {[
              ['Merkle root', shortHex(MERKLE_ROOT)],
              ['Verifier key hash', shortHex(VK_HASH)],
              ['Contract', shortHex(CONTRACT_ID)],
              ['Proof system', 'Groth16 BLS12-381'],
            ].map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="mono text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-5 flex-wrap">
            <a href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm">
              Open Explorer
            </a>
            <Link href="/receipt" className="btn-primary text-sm">Inspect Receipt</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
