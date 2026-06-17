'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchStats,
  fetchIsPaused,
  buildSetPausedTransaction,
  buildFundTransaction,
  submitSignedTransaction,
  type CampaignStats,
} from '@/lib/soroban';
import { isFreighterInstalled, connectWallet, signTx } from '@/lib/freighter';
import {
  CONTRACT_ID, VERIFIER_CONTRACT_ID, EXPLORER_BASE,
  stroopsToXlm, shortHex, DISBURSEMENT_ID, MERKLE_ROOT,
} from '@/lib/constants';
import type { BeneficiaryCredential } from '@/lib/credential';

type FundStep = 'idle' | 'building' | 'signing' | 'submitting' | 'done' | 'error';
type PauseStep = 'idle' | 'building' | 'signing' | 'submitting' | 'done' | 'error';
type IssueStep = 'idle' | 'issuing' | 'done' | 'error';

export default function AdminPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isPaused, setIsPaused] = useState<boolean | null>(null);

  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState('');

  const [fundAmount, setFundAmount] = useState('50');
  const [fundStep, setFundStep] = useState<FundStep>('idle');
  const [fundTxHash, setFundTxHash] = useState('');
  const [fundError, setFundError] = useState('');

  const [pauseStep, setPauseStep] = useState<PauseStep>('idle');
  const [pauseError, setPauseError] = useState('');
  const [pauseTxHash, setPauseTxHash] = useState('');

  const [recipientAddress, setRecipientAddress] = useState('');
  const [issueStep, setIssueStep] = useState<IssueStep>('idle');
  const [issuedCredential, setIssuedCredential] = useState<BeneficiaryCredential | null>(null);
  const [issueError, setIssueError] = useState('');
  const [copied, setCopied] = useState(false);

  const [activityLog, setActivityLog] = useState<string[]>([]);

  function log(line: string) {
    setActivityLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev]);
  }

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const [s, paused] = await Promise.all([fetchStats(), fetchIsPaused()]);
      setStats(s);
      setIsPaused(paused);
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

  async function handleSetPaused(paused: boolean) {
    if (!walletAddress) { setPauseError('Connect your Freighter wallet first'); return; }
    setPauseError('');
    setPauseTxHash('');
    setPauseStep('building');
    log(`${paused ? 'Pausing' : 'Unpausing'} campaign…`);

    try {
      const txXDR = await buildSetPausedTransaction(walletAddress, paused);
      setPauseStep('signing');
      log('Waiting for Freighter signature…');
      const signedXDR = await signTx(txXDR, walletAddress);
      setPauseStep('submitting');
      log('Broadcasting…');
      const hash = await submitSignedTransaction(signedXDR);
      setPauseTxHash(hash);
      setPauseStep('done');
      setIsPaused(paused);
      log(`Campaign ${paused ? 'paused' : 'unpaused'} ✓ tx: ${hash.slice(0, 12)}…`);
      await loadStats();
    } catch (e) {
      const msg = String(e);
      setPauseError(msg);
      setPauseStep('error');
      log(`Pause error: ${msg.slice(0, 80)}`);
    }
  }

  async function handleFund() {
    if (!walletAddress) { setFundError('Connect your Freighter wallet first'); return; }
    setFundError('');
    setFundTxHash('');
    const xlm = parseFloat(fundAmount);
    if (isNaN(xlm) || xlm <= 0) { setFundError('Enter a valid XLM amount'); return; }
    const stroops = Math.round(xlm * 10_000_000);

    try {
      setFundStep('building');
      log(`Building fund tx — ${xlm} XLM`);
      const txXDR = await buildFundTransaction(walletAddress, stroops);
      setFundStep('signing');
      log('Waiting for Freighter signature…');
      const signedXDR = await signTx(txXDR, walletAddress);
      setFundStep('submitting');
      log('Broadcasting…');
      const hash = await submitSignedTransaction(signedXDR);
      setFundTxHash(hash);
      setFundStep('done');
      log(`Funded ✓ tx: ${hash.slice(0, 12)}…`);
      await loadStats();
    } catch (e) {
      const msg = String(e);
      setFundError(msg);
      setFundStep('error');
      log(`Fund error: ${msg.slice(0, 80)}`);
    }
  }

  async function handleIssueCredential() {
    const addr = recipientAddress.trim();
    if (!addr) { setIssueError('Enter a recipient Stellar address'); return; }
    if (!/^G[A-Z0-9]{55}$/.test(addr)) {
      setIssueError('Invalid Stellar address (must start with G, 56 chars)');
      return;
    }
    setIssueStep('issuing');
    setIssueError('');
    setIssuedCredential(null);
    setCopied(false);
    log(`Issuing credential to ${addr.slice(0, 8)}…`);

    try {
      const res = await fetch('/api/issue-credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimant_address: addr }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error);
      }
      const cred = await res.json() as BeneficiaryCredential;
      setIssuedCredential(cred);
      setIssueStep('done');
      log(`Credential issued ✓ slot ${cred.slot_index} → ${addr.slice(0, 8)}…`);
    } catch (e) {
      setIssueError(String(e));
      setIssueStep('error');
      log(`Issue error: ${String(e).slice(0, 80)}`);
    }
  }

  function handleDownloadCredential() {
    if (!issuedCredential) return;
    const blob = new Blob([JSON.stringify(issuedCredential, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aidshield-credential-slot${issuedCredential.slot_index}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyCredential() {
    if (!issuedCredential) return;
    await navigator.clipboard.writeText(JSON.stringify(issuedCredential, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fundBusy = fundStep === 'building' || fundStep === 'signing' || fundStep === 'submitting';
  const pauseBusy = pauseStep === 'building' || pauseStep === 'signing' || pauseStep === 'submitting';

  const utilization =
    stats && stats.claimed_count > 0 && stats.payout_amount > 0n
      ? (Number(BigInt(stats.claimed_count) * stats.payout_amount) /
          Number(stats.escrow_balance + BigInt(stats.claimed_count) * stats.payout_amount)) * 100
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Operator Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Issue credentials · Fund escrow · Pause/unpause · Monitor campaign
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge" style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.7rem' }}>
            Stellar Testnet
          </span>
          <a href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm">
            Explorer ↗
          </a>
        </div>
      </div>

      {/* ── Campaign State ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-4">Campaign State</div>

        {loadingStats && isPaused === null ? (
          <div className="text-sm py-2" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : (
          <div className="space-y-4">
            {/* Paused status + toggle */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-medium mb-0.5">Claims status</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  Admin can halt and re-enable claims without redeploying contracts.
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isPaused === null ? (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                ) : isPaused ? (
                  <span className="badge" style={{ background: '#450a0a', color: '#fca5a5', fontSize: '0.7rem' }}>
                    ⏸ PAUSED
                  </span>
                ) : (
                  <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                    ▶ ACTIVE
                  </span>
                )}
                {walletAddress && (
                  <button
                    className={isPaused ? 'btn-primary text-sm' : 'btn-outline text-sm'}
                    style={isPaused ? {} : { color: '#f87171', borderColor: 'rgba(248,81,73,0.4)' }}
                    onClick={() => handleSetPaused(!isPaused)}
                    disabled={pauseBusy || isPaused === null}
                  >
                    {pauseBusy
                      ? pauseStep === 'building' ? 'Building…'
                        : pauseStep === 'signing' ? 'Waiting…'
                        : 'Submitting…'
                      : isPaused ? 'Unpause claims' : 'Pause claims'}
                  </button>
                )}
              </div>
            </div>

            {pauseError && (
              <div className="text-xs p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid rgba(248,81,73,0.25)' }}>
                {pauseError}
              </div>
            )}
            {pauseStep === 'done' && pauseTxHash && (
              <div className="text-xs p-2 rounded-lg" style={{ background: '#0a1f14', color: 'var(--green)', border: '1px solid var(--green-dim)' }}>
                ✓{' '}
                <a href={`${EXPLORER_BASE}/tx/${pauseTxHash}`} target="_blank" rel="noopener noreferrer" className="underline">
                  {shortHex(pauseTxHash)} ↗
                </a>
              </div>
            )}

            {/* Contracts */}
            <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '1rem' }}>
              <div className="text-sm font-medium mb-2">Contract addresses</div>
              <div className="space-y-2 text-xs mono">
                {[
                  { label: 'Disbursement', id: CONTRACT_ID },
                  { label: 'Groth16 Verifier', id: VERIFIER_CONTRACT_ID },
                ].map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap">
                    <span style={{ color: 'var(--muted)' }}>{c.label}</span>
                    <a
                      href={`${EXPLORER_BASE}/contract/${c.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="underline" style={{ color: 'var(--green)', wordBreak: 'break-all' }}
                    >
                      {shortHex(c.id)} ↗
                    </a>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span style={{ color: 'var(--muted)' }}>Merkle root</span>
                  <span style={{ color: 'var(--muted-2)', wordBreak: 'break-all' }}>{shortHex(MERKLE_ROOT)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span style={{ color: 'var(--muted)' }}>Disbursement ID</span>
                  <span style={{ color: 'var(--muted-2)', wordBreak: 'break-all' }}>{shortHex(DISBURSEMENT_ID)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Issue Credential ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1 flex items-center gap-2">
          Issue Beneficiary Credential
          <span className="badge" style={{ background: '#0e3a1d', color: 'var(--green-bright)', fontSize: '0.65rem' }}>
            Operator only
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Sign a credential binding the Merkle witness + secret to a specific wallet.
          Only that wallet can use it to generate a valid proof.
        </p>

        <div className="flex gap-3 items-end mb-4 flex-wrap">
          <div className="flex-1" style={{ minWidth: 280 }}>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
              Recipient Stellar address (G…)
            </label>
            <input
              type="text"
              placeholder="GXXXXXX…"
              value={recipientAddress}
              onChange={(e) => { setRecipientAddress(e.target.value); setIssueError(''); }}
              disabled={issueStep === 'issuing'}
              className="mono text-sm"
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleIssueCredential}
            disabled={issueStep === 'issuing' || !recipientAddress.trim()}
          >
            {issueStep === 'issuing' ? 'Signing…' : 'Issue Credential'}
          </button>
        </div>

        {issueError && (
          <div className="text-sm p-3 rounded-lg mb-3" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {issueError}
          </div>
        )}

        {issuedCredential && issueStep === 'done' && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(63,185,80,0.25)' }}>
            <div
              className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: '#0a1f14', borderBottom: '1px solid rgba(63,185,80,0.15)' }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--green-bright)', fontWeight: 600, fontSize: '0.875rem' }}>
                  ✓ Credential signed
                </span>
                <span className="mono text-xs" style={{ color: 'var(--muted)' }}>
                  slot {issuedCredential.slot_index} · expires {new Date(issuedCredential.expires_at * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--muted-2)', border: '1px solid var(--border)' }}
                  onClick={handleCopyCredential}
                >
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'var(--green-dim)', color: 'var(--green-bright)', border: '1px solid rgba(63,185,80,0.3)' }}
                  onClick={handleDownloadCredential}
                >
                  Download
                </button>
              </div>
            </div>
            <div className="mono text-xs p-4 overflow-auto max-h-64" style={{ background: '#040d07', color: 'var(--muted)' }}>
              <pre>{JSON.stringify(issuedCredential, null, 2)}</pre>
            </div>
            <div className="px-4 py-3 text-xs" style={{ background: '#0a1f14', color: 'var(--muted)' }}>
              Share privately with the beneficiary. They paste it into{' '}
              <a href="/claim" className="underline" style={{ color: 'var(--green)' }}>Claim</a>{' '}
              — the secret never leaves their device.
            </div>
          </div>
        )}
      </div>

      {/* ── Wallet ── */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">Freighter Wallet</span>
          {walletInstalled === false && <span className="badge" style={{ background: '#450a0a', color: '#fca5a5' }}>Not detected</span>}
          {walletInstalled === true && !walletAddress && <span className="badge" style={{ background: '#1c1917', color: '#a8a29e' }}>Installed</span>}
          {walletAddress && <span className="badge badge-green">Connected</span>}
        </div>
        {!walletAddress ? (
          <div>
            <button className="btn-primary w-full" onClick={handleConnectWallet}>
              Connect Freighter
            </button>
            {walletInstalled === false && (
              <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                Freighter not found — <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="underline">install the extension</a> then reload.
              </p>
            )}
            {walletError && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{walletError}</p>}
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Required for pause/unpause and fund escrow. Credential issuance works without a wallet.
            </p>
          </div>
        ) : (
          <div className="mono text-xs p-3 rounded-lg" style={{ background: '#0a1628', wordBreak: 'break-all' }}>
            {walletAddress}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      {loadingStats && !stats ? (
        <div className="card text-center py-12" style={{ color: 'var(--muted)' }}>Loading on-chain data…</div>
      ) : statsError ? (
        <div className="card text-center py-12" style={{ color: '#f87171' }}>{statsError}</div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Escrow Balance', value: `${stroopsToXlm(stats.escrow_balance)} XLM`, green: true },
            { label: 'Claims Paid', value: String(stats.claimed_count), green: false },
            { label: 'Payout / Claim', value: `${stroopsToXlm(stats.payout_amount)} XLM`, green: false },
            { label: 'Utilization', value: `${utilization.toFixed(1)}%`, green: false },
          ].map((s) => (
            <div key={s.label} className="card">
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: 6 }}>{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.green ? 'var(--green)' : 'var(--text)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Fund escrow ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1">Fund Escrow</div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Deposit XLM from your Freighter wallet into the contract escrow.
        </p>
        <div className="flex gap-3 items-end mb-4">
          <div className="flex-1">
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Amount (XLM)</label>
            <input type="number" min="1" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} disabled={fundBusy} />
          </div>
          <button className="btn-primary" onClick={handleFund} disabled={fundBusy || !walletAddress}>
            {!walletAddress ? 'Connect wallet'
              : fundStep === 'building' ? 'Building…'
              : fundStep === 'signing' ? 'Waiting for signature…'
              : fundStep === 'submitting' ? 'Submitting…'
              : fundStep === 'done' ? 'Fund again'
              : 'Fund Escrow'}
          </button>
        </div>
        {fundStep === 'done' && fundTxHash && (
          <div className="text-sm p-3 rounded-lg mb-3" style={{ background: '#0a1f14', border: '1px solid var(--green-dim)', color: 'var(--green)' }}>
            Funded ✓{' '}
            <a href={`${EXPLORER_BASE}/tx/${fundTxHash}`} target="_blank" rel="noopener noreferrer" className="underline ml-1">
              {shortHex(fundTxHash)} ↗
            </a>
          </div>
        )}
        {fundError && (
          <div className="text-sm p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {fundError}
          </div>
        )}
      </div>

      {/* ── Activity log ── */}
      {activityLog.length > 0 && (
        <div className="card">
          <div className="font-semibold mb-3 text-sm">Activity Log</div>
          <div className="space-y-1 mono text-xs" style={{ color: 'var(--muted)' }}>
            {activityLog.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
