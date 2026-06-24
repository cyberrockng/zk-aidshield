'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchStats,
  fetchIsPaused,
  fetchGovernanceThreshold,
  checkVendorActive,
  checkIssuerActive,
  type CampaignStats,
} from '@/lib/soroban';
import { evaluatePolicy, type PolicyPosture, type ControlStatus, type ControlLayer } from '@/lib/policy-engine';
import {
  ADMIN_ADDRESS,
  CONTRACT_ID,
  DISBURSEMENT_ID,
  EXPLORER_BASE,
  ISSUER_KEY_ID,
  MERKLE_ROOT,
  VK_HASH,
  shortHex,
  stroopsToXlm,
} from '@/lib/constants';

interface ThreatSnapshot {
  stats: CampaignStats;
  paused: boolean;
  issuerActive: boolean;
  vendorActive: boolean;
  governanceThreshold: number;
  posture: PolicyPosture;
  updatedAt: Date;
}

const STATUS_STYLE: Record<ControlStatus, { label: string; className: string }> = {
  blocked: { label: 'Blocked', className: 'badge badge-green' },
  monitored: { label: 'Monitored', className: 'badge badge-blue' },
  limited: { label: 'Needs action', className: 'badge badge-amber' },
};

const LAYER_COPY: Record<ControlLayer, string> = {
  'zk-circuit': 'ZK circuit',
  soroban: 'Soroban',
  operator: 'Operator',
  auditor: 'Auditor',
};

const INCIDENT_PLAYBOOK = [
  ['Compromised issuer', 'Revoke issuer key on-chain, pause claims if needed, regenerate campaign credentials under a fresh issuer.'],
  ['Vendor compromise', 'Revoke vendor address, keep cash route available, review settlement events and local vendor records.'],
  ['Credential leak', 'Wallet binding prevents other wallets from claiming; if claimant wallet is compromised, pause and rotate campaign root.'],
  ['Replay attempt', 'Nullifier check blocks the transaction; auditor dashboard keeps aggregate settlement count visible.'],
  ['Field officer anomaly', 'Use the non-PII ledger to compare keyed wallet identifiers, credential hashes, expiry windows, and delivery mode.'],
];

const ATTACK_THEATER = [
  ['Replay Attack', 'Attempt to submit the same credential after a successful claim.', 'Soroban nullifier set rejects the second claim.', 'Soroban'],
  ['Wrong Wallet', 'Switch Freighter and load a credential issued to another wallet.', 'Credential verification and claimant binding reject it.', 'Frontend + ZK public input'],
  ['Unauthorized Vendor', 'Try voucher redemption to a vendor that is not approved.', 'Vendor registry blocks the payout route.', 'Soroban'],
  ['Revoked Issuer', 'Use a credential signed under an inactive issuer key.', 'Issuer registry prevents settlement.', 'Soroban'],
  ['Expired Credential', 'Submit a proof carrying an expired timestamp.', 'Ledger-time expiry check rejects it.', 'Soroban'],
  ['Emergency Incident', 'Pause claims during key or vendor compromise.', 'Pause control blocks payout execution.', 'Governance'],
];

function statusTone(status: ControlStatus): string {
  if (status === 'blocked') return 'var(--green-bright)';
  if (status === 'monitored') return 'var(--blue)';
  return 'var(--amber)';
}

export default function ThreatDashboardPage() {
  const [snapshot, setSnapshot] = useState<ThreatSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [stats, paused, issuerActive, vendorActive, governanceThreshold] = await Promise.all([
        fetchStats(),
        fetchIsPaused(),
        checkIssuerActive(ISSUER_KEY_ID),
        checkVendorActive(ADMIN_ADDRESS),
        fetchGovernanceThreshold(),
      ]);
      const posture = evaluatePolicy({
        paused,
        issuerActive,
        vendorActive,
        governanceThreshold,
        escrowBalanceStroops: stats.escrow_balance,
        payoutAmountStroops: stats.payout_amount,
        claimedCount: stats.claimed_count,
        ledgerEntries: stats.claimed_count,
      });
      setSnapshot({ stats, paused, issuerActive, vendorActive, governanceThreshold, posture, updatedAt: new Date() });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 20_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="max-w-5xl mx-auto">
      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-5 flex-wrap">
          <div style={{ maxWidth: 760 }}>
            <div className="badge badge-amber mb-4">Threat resistance layer</div>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Privacy That Does Not Become A Back Door</h1>
            <p className="text-sm md:text-base" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              AidShield protects beneficiaries with zero knowledge, while campaign policy controls keep issuers, vendors,
              replay attempts, escrow health, and emergency response visible to operators and auditors.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary text-sm" onClick={refresh} disabled={loading}>
              {loading ? 'Checking…' : 'Refresh'}
            </button>
            <Link href="/edge" className="btn-outline text-sm">Edge</Link>
            <Link href="/auditor" className="btn-outline text-sm">Auditor</Link>
            <Link href="/admin" className="btn-outline text-sm">Admin</Link>
            <Link href="/judge-mode" className="btn-outline text-sm">Judge Mode</Link>
          </div>
        </div>
      </section>

      {error && (
        <div className="card mb-6" style={{ borderColor: 'rgba(248,81,73,0.35)', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {loading && !snapshot ? (
        <div className="card text-center py-16" style={{ color: 'var(--muted)' }}>
          Loading live policy controls…
        </div>
      ) : snapshot ? (
        <>
          <section className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="metric-card">
              <div className="metric-label">Policy score</div>
              <div className="metric-value" style={{ color: snapshot.posture.score >= 90 ? 'var(--green-bright)' : 'var(--amber)' }}>
                {snapshot.posture.score}%
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Blocked</div>
              <div className="metric-value" style={{ color: 'var(--green-bright)' }}>{snapshot.posture.blockedCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Monitored</div>
              <div className="metric-value" style={{ color: 'var(--blue)' }}>{snapshot.posture.monitoredCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Needs action</div>
              <div className="metric-value" style={{ color: 'var(--amber)' }}>{snapshot.posture.limitedCount}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Remaining claims</div>
              <div className="metric-value">{snapshot.posture.remainingClaims}</div>
            </div>
          </section>

          <section className="card mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
              <div>
                <div className="font-semibold text-lg mb-1">Campaign Policy Snapshot</div>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Updated {snapshot.updatedAt.toLocaleTimeString()} from Stellar testnet simulation reads.
                </p>
              </div>
              <span className={snapshot.posture.score >= 90 ? 'badge badge-green' : 'badge badge-amber'}>
                {snapshot.posture.label}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 text-sm">
              {[
                ['Contract', shortHex(CONTRACT_ID)],
                ['Disbursement ID', shortHex(DISBURSEMENT_ID)],
                ['Merkle root', shortHex(MERKLE_ROOT)],
                ['VK hash', shortHex(VK_HASH)],
                ['Claims paused', snapshot.paused ? 'Yes' : 'No'],
                ['Issuer active', snapshot.issuerActive ? 'Yes' : 'No'],
                ['Demo vendor active', snapshot.vendorActive ? 'Yes' : 'No'],
                ['Governance threshold', String(snapshot.governanceThreshold)],
                ['Escrow remaining', `${stroopsToXlm(snapshot.stats.escrow_balance)} XLM`],
                ['Claims paid', String(snapshot.stats.claimed_count)],
              ].map(([label, value]) => (
                <div key={label} className="data-row">
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span className="mono text-xs text-right" style={{ wordBreak: 'break-all' }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="card mb-6">
            <div className="font-semibold text-lg mb-5">Attack Controls</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {snapshot.posture.controls.map((control) => {
                const style = STATUS_STYLE[control.status];
                return (
                  <div key={control.id} className="threat-card">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="font-semibold mb-1">{control.title}</div>
                        <div className="mono text-xs" style={{ color: statusTone(control.status) }}>{LAYER_COPY[control.layer]}</div>
                      </div>
                      <span className={style.className} style={{ fontSize: '0.65rem' }}>{style.label}</span>
                    </div>
                    <p className="text-sm mb-3" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{control.evidence}</p>
                    {control.weakness && (
                      <p className="text-xs" style={{ color: 'var(--amber)', lineHeight: 1.5 }}>{control.weakness}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <div className="font-semibold text-lg mb-1">Attack Replay Theater</div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                  Use these beats in the video or live judging session to show that privacy does not become uncontrolled payout access.
                </p>
              </div>
              <Link href="/evidence" className="btn-outline text-sm">Evidence Matrix</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="edge-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Attempt</th>
                    <th>Expected Result</th>
                    <th>Enforced By</th>
                  </tr>
                </thead>
                <tbody>
                  {ATTACK_THEATER.map(([scenario, attempt, result, layer]) => (
                    <tr key={scenario}>
                      <td>{scenario}</td>
                      <td>{attempt}</td>
                      <td>{result}</td>
                      <td className="mono">{layer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <div className="font-semibold text-lg mb-4">Incident Playbook</div>
              <div className="space-y-4">
                {INCIDENT_PLAYBOOK.map(([title, body]) => (
                  <div key={title} className="pb-4" style={{ borderBottom: '1px solid var(--border-dim)' }}>
                    <div className="font-semibold text-sm mb-1">{title}</div>
                    <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="font-semibold text-lg mb-4">Why This Matters</div>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                The strongest privacy products define who gets privacy and under what accountable rules.
                AidShield keeps the beneficiary witness private, but it does not create an unrestricted anonymous payout pool.
              </p>
              <div className="space-y-3 text-sm">
                {[
                  'Only pre-approved campaign credentials can prove eligibility.',
                  'Only active issuers can back valid claims.',
                  'Only approved vendors can receive voucher redemptions.',
                  'Every successful claim consumes one wallet-bound nullifier.',
                  'Escrow and aggregate settlement remain publicly auditable.',
                ].map((line) => (
                  <div key={line} className="flex gap-3" style={{ color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--green-bright)' }}>✓</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              <a
                href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline text-sm mt-5"
              >
                Open Contract
              </a>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
