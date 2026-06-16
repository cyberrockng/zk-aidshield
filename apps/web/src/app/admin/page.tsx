'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchStats, buildFundTransaction, submitSignedTransaction, type CampaignStats } from '@/lib/soroban';
import { isFreighterInstalled, connectWallet, signTx } from '@/lib/freighter';
import { CONTRACT_ID, EXPLORER_BASE, stroopsToXlm, shortHex, DISBURSEMENT_ID, MERKLE_ROOT } from '@/lib/constants';

type FundStep = 'idle' | 'building' | 'signing' | 'submitting' | 'done' | 'error';

export default function AdminPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState('');

  const [fundAmount, setFundAmount] = useState('50');
  const [fundStep, setFundStep] = useState<FundStep>('idle');
  const [fundTxHash, setFundTxHash] = useState('');
  const [fundError, setFundError] = useState('');
  const [activityLog, setActivityLog] = useState<string[]>([]);

  function log(line: string) {
    setActivityLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev]);
  }

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

  useEffect(() => {
    isFreighterInstalled().then(setWalletInstalled);
  }, []);

  async function handleConnectWallet() {
    setWalletError('');
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
      log(`Wallet connected: ${addr.slice(0, 8)}…${addr.slice(-6)}`);
    } catch (e) {
      setWalletError(String(e));
    }
  }

  async function handleFund() {
    if (!walletAddress) {
      setFundError('Connect your Freighter wallet first');
      return;
    }
    setFundError('');
    setFundTxHash('');
    const xlm = parseFloat(fundAmount);
    if (isNaN(xlm) || xlm <= 0) {
      setFundError('Enter a valid XLM amount');
      return;
    }
    const stroops = Math.round(xlm * 10_000_000);

    try {
      setFundStep('building');
      log(`Building fund transaction — ${xlm} XLM from ${walletAddress.slice(0, 8)}…`);
      const txXDR = await buildFundTransaction(walletAddress, stroops);

      setFundStep('signing');
      log('Waiting for Freighter signature…');
      const signedXDR = await signTx(txXDR, walletAddress);

      setFundStep('submitting');
      log('Broadcasting to Stellar testnet…');
      const hash = await submitSignedTransaction(signedXDR);

      setFundTxHash(hash);
      setFundStep('done');
      log(`Funded ✓ tx: ${hash.slice(0, 12)}…`);
      await loadStats();
    } catch (e) {
      const msg = String(e);
      setFundError(msg);
      setFundStep('error');
      log(`Error: ${msg.slice(0, 80)}`);
    }
  }

  const busy = fundStep !== 'idle' && fundStep !== 'done' && fundStep !== 'error';

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
        <div className="flex items-center gap-3">
          <span className="badge" style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.7rem' }}>
            Stellar Testnet
          </span>
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm"
          >
            View on Explorer ↗
          </a>
        </div>
      </div>

      {/* Wallet status panel */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">Freighter Wallet</span>
          {walletInstalled === false && (
            <span className="badge" style={{ background: '#450a0a', color: '#fca5a5' }}>
              Not detected
            </span>
          )}
          {walletInstalled === true && !walletAddress && (
            <span className="badge" style={{ background: '#1c1917', color: '#a8a29e' }}>
              Installed
            </span>
          )}
          {walletAddress && (
            <span className="badge badge-green">Connected</span>
          )}
        </div>

        {!walletAddress ? (
          <div>
            <button className="btn-primary w-full" onClick={handleConnectWallet}>
              Connect Freighter
            </button>
            {walletInstalled === false && (
              <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                Freighter not found —{' '}
                <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="underline">
                  install the extension
                </a>{' '}
                then reload.
              </p>
            )}
            {walletError && (
              <p className="text-xs mt-2" style={{ color: '#f87171' }}>{walletError}</p>
            )}
          </div>
        ) : (
          <div className="mono text-xs p-3 rounded-lg" style={{ background: '#0a1628', wordBreak: 'break-all' }}>
            {walletAddress}
          </div>
        )}
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
      <div className="card mb-6">
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
              disabled={busy}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleFund}
            disabled={busy || !walletAddress}
          >
            {!walletAddress
              ? 'Connect wallet'
              : fundStep === 'building'
              ? 'Build transaction…'
              : fundStep === 'signing'
              ? 'Waiting for signature…'
              : fundStep === 'submitting'
              ? 'Submitting to testnet…'
              : fundStep === 'done'
              ? 'Fund again'
              : 'Fund Escrow'}
          </button>
        </div>

        {fundStep === 'done' && fundTxHash && (
          <div
            className="text-sm p-3 rounded-lg mb-3"
            style={{ background: '#0a1f14', border: '1px solid var(--green-dim)', color: 'var(--green)' }}
          >
            Funding confirmed ✓{' '}
            <a
              href={`${EXPLORER_BASE}/tx/${fundTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline ml-1"
            >
              {shortHex(fundTxHash)} ↗
            </a>
          </div>
        )}

        {fundError && (
          <div
            className="text-sm p-3 rounded-lg"
            style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}
          >
            {fundError}
          </div>
        )}
      </div>

      {/* Activity log */}
      {activityLog.length > 0 && (
        <div className="card">
          <div className="font-semibold mb-3 text-sm">Activity Log</div>
          <div className="space-y-1 mono text-xs" style={{ color: 'var(--muted)' }}>
            {activityLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
