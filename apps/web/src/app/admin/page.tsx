'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchStats, buildFundTransaction, submitSignedTransaction, type CampaignStats } from '@/lib/soroban';
import { getWalletAddress, signTx } from '@/lib/freighter';
import { CONTRACT_ID, EXPLORER_BASE, stroopsToXlm, shortHex, DISBURSEMENT_ID, MERKLE_ROOT } from '@/lib/constants';

type FundStep = 'idle' | 'connecting' | 'building' | 'signing' | 'submitting' | 'done' | 'error';

export default function AdminPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [fundAmount, setFundAmount] = useState('50');
  const [fundStep, setFundStep] = useState<FundStep>('idle');
  const [fundTxHash, setFundTxHash] = useState('');
  const [fundError, setFundError] = useState('');

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      setStats(await fetchStats());
    } catch (e) {
      setStatsError(String(e));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 15_000);
    return () => clearInterval(id);
  }, [loadStats]);

  async function handleFund() {
    setFundError('');
    setFundTxHash('');
    const xlm = parseFloat(fundAmount);
    if (isNaN(xlm) || xlm <= 0) {
      setFundError('Enter a valid XLM amount');
      return;
    }
    const stroops = Math.round(xlm * 10_000_000);

    try {
      setFundStep('connecting');
      const address = await getWalletAddress();

      setFundStep('building');
      const txXDR = await buildFundTransaction(address, stroops);

      setFundStep('signing');
      const signedXDR = await signTx(txXDR);

      setFundStep('submitting');
      const hash = await submitSignedTransaction(signedXDR);

      setFundTxHash(hash);
      setFundStep('done');
      await loadStats();
    } catch (e) {
      setFundError(String(e));
      setFundStep('error');
    }
  }

  const utilization =
    stats
      ? stats.claimed_count > 0 && stats.payout_amount > 0n
        ? (Number(BigInt(stats.claimed_count) * stats.payout_amount) /
            Number(stats.escrow_balance + BigInt(stats.claimed_count) * stats.payout_amount)) *
          100
        : 0
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Campaign Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Live stats from Soroban testnet · refreshes every 15s
          </p>
        </div>
        <a
          href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline text-sm"
        >
          View on Explorer ↗
        </a>
      </div>

      {/* Stats cards */}
      {loadingStats && !stats ? (
        <div className="card text-center py-12" style={{ color: 'var(--muted)' }}>
          Loading on-chain data…
        </div>
      ) : statsError ? (
        <div className="card text-center py-12" style={{ color: '#f87171' }}>
          {statsError}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: 6 }}>
                Escrow Balance
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--green)' }}>
                {stroopsToXlm(stats.escrow_balance)} XLM
              </div>
            </div>
            <div className="card">
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: 6 }}>
                Claims Paid
              </div>
              <div className="text-2xl font-bold">{stats.claimed_count}</div>
            </div>
            <div className="card">
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: 6 }}>
                Payout / Claim
              </div>
              <div className="text-2xl font-bold">
                {stroopsToXlm(stats.payout_amount)} XLM
              </div>
            </div>
            <div className="card">
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: 6 }}>
                Utilization
              </div>
              <div className="text-2xl font-bold">{utilization.toFixed(1)}%</div>
            </div>
          </div>

          {/* Campaign details */}
          <div className="card mb-6">
            <div className="font-semibold mb-4">Campaign Details</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {[
                {
                  label: 'Contract ID',
                  value: CONTRACT_ID,
                  link: `${EXPLORER_BASE}/contract/${CONTRACT_ID}`,
                },
                { label: 'Disbursement ID', value: DISBURSEMENT_ID, link: null },
                { label: 'Merkle Root', value: MERKLE_ROOT, link: null },
                { label: 'Network', value: 'Stellar Testnet (Protocol 26)', link: null },
              ].map((row) => (
                <div key={row.label}>
                  <div style={{ color: 'var(--muted)', marginBottom: 2 }}>{row.label}</div>
                  {row.link ? (
                    <a
                      href={row.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono underline"
                      style={{ wordBreak: 'break-all' }}
                    >
                      {shortHex(row.value)}
                    </a>
                  ) : (
                    <div className="mono" style={{ wordBreak: 'break-all' }}>
                      {shortHex(row.value)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* Fund escrow */}
      <div className="card">
        <div className="font-semibold mb-1">Fund Escrow</div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Deposit XLM from your Freighter wallet into the contract escrow.
        </p>

        <div className="flex gap-3 items-end mb-4">
          <div className="flex-1">
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
              Amount (XLM)
            </label>
            <input
              type="number"
              min="1"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              disabled={fundStep !== 'idle' && fundStep !== 'done' && fundStep !== 'error'}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleFund}
            disabled={fundStep !== 'idle' && fundStep !== 'done' && fundStep !== 'error'}
          >
            {fundStep === 'idle' || fundStep === 'done' || fundStep === 'error'
              ? 'Fund Escrow'
              : '...'}
          </button>
        </div>

        {fundStep !== 'idle' && (
          <div className="text-sm space-y-1 mono">
            {(['connecting', 'building', 'signing', 'submitting', 'done'] as FundStep[]).map(
              (s, i, arr) => {
                const currentIdx = arr.indexOf(fundStep);
                const cls =
                  i < currentIdx || fundStep === 'done'
                    ? 'step-done'
                    : i === currentIdx
                    ? 'step-active'
                    : 'step-wait';
                const icons = ['🔑', '🔨', '✍️', '🚀', '✅'];
                const labels = [
                  'Connect wallet',
                  'Build transaction',
                  'Sign with Freighter',
                  'Submit to Stellar',
                  'Confirmed',
                ];
                return (
                  <div key={s} className={cls}>
                    {icons[i]} {labels[i]}
                    {fundStep === 'done' && s === 'done' && fundTxHash && (
                      <a
                        href={`${EXPLORER_BASE}/tx/${fundTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline ml-2"
                      >
                        {shortHex(fundTxHash)}
                      </a>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}

        {fundError && (
          <div
            className="text-sm mt-3 p-3 rounded-lg"
            style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}
          >
            {fundError}
          </div>
        )}
      </div>
    </div>
  );
}
