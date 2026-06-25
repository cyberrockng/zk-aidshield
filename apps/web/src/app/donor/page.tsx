'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { buildFundTransaction, fetchStats, submitSignedTransaction, type CampaignStats } from '@/lib/soroban';
import { connectWallet, isFreighterInstalled, signTx } from '@/lib/freighter';
import {
  CONTRACT_ID,
  DISBURSEMENT_ID,
  EXPLORER_BASE,
  MERKLE_ROOT,
  VERIFIER_CONTRACT_ID,
  shortHex,
  stroopsToXlm,
} from '@/lib/constants';

interface DonorReceipt {
  type: 'donor_funding_receipt';
  version: '1';
  campaign: string;
  amount: string;
  amount_stroops: number;
  funder_address: string;
  tx_hash: string;
  contract: string;
  verifier_contract: string;
  disbursement_id: string;
  merkle_root: string;
  funded_at: string;
  impact_capacity_added: string;
  privacy_statement: string;
  public_settlement_fields: string[];
}

type FundStep = 'idle' | 'building' | 'signing' | 'submitting' | 'done' | 'error';

const STORAGE_KEY = 'aidshield_donor_receipts';

function loadReceipts(): DonorReceipt[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as DonorReceipt[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReceipts(receipts: DonorReceipt[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts.slice(0, 10)));
}

export default function DonorPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [walletInstalled, setWalletInstalled] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [amount, setAmount] = useState('1');
  const [step, setStep] = useState<FundStep>('idle');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<DonorReceipt | null>(null);
  const [receipts, setReceipts] = useState<DonorReceipt[]>([]);
  const [copied, setCopied] = useState(false);

  const refreshStats = useCallback(async () => {
    const next = await fetchStats();
    setStats(next);
  }, []);

  useEffect(() => {
    isFreighterInstalled().then(setWalletInstalled);
    refreshStats().catch(() => {});
    setReceipts(loadReceipts());
  }, [refreshStats]);

  const model = useMemo(() => {
    if (!stats) return null;
    const remaining = stats.payout_amount > 0n ? stats.escrow_balance / stats.payout_amount : 0n;
    const paid = BigInt(stats.claimed_count) * stats.payout_amount;
    return { remaining, paid };
  }, [stats]);

  async function connect() {
    setError('');
    try {
      setWalletAddress(await connectWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function fund() {
    if (!walletAddress) {
      setError('Connect Freighter first');
      return;
    }
    const xlm = Number(amount);
    if (!Number.isFinite(xlm) || xlm <= 0) {
      setError('Enter a valid XLM amount');
      return;
    }
    const stroops = Math.round(xlm * 10_000_000);
    setError('');
    setReceipt(null);

    try {
      setStep('building');
      const txXdr = await buildFundTransaction(walletAddress, stroops);
      setStep('signing');
      const signedXdr = await signTx(txXdr, walletAddress);
      setStep('submitting');
      const txHash = await submitSignedTransaction(signedXdr);
      const impactCapacity = stats?.payout_amount && stats.payout_amount > 0n
        ? Math.floor(stroops / Number(stats.payout_amount))
        : Math.floor(xlm);
      const nextReceipt: DonorReceipt = {
        type: 'donor_funding_receipt',
        version: '1',
        campaign: 'Flood Relief Round 1',
        amount: `${xlm} XLM`,
        amount_stroops: stroops,
        funder_address: walletAddress,
        tx_hash: txHash,
        contract: CONTRACT_ID,
        verifier_contract: VERIFIER_CONTRACT_ID,
        disbursement_id: DISBURSEMENT_ID,
        merkle_root: MERKLE_ROOT,
        funded_at: new Date().toISOString(),
        impact_capacity_added: `${impactCapacity} private claim${impactCapacity === 1 ? '' : 's'}`,
        privacy_statement: 'Donor funding is public. Beneficiary identities, credentials, and Merkle witnesses remain hidden.',
        public_settlement_fields: ['donor wallet', 'transaction hash', 'amount', 'contract id', 'ledger time'],
      };
      const nextReceipts = [nextReceipt, ...receipts];
      saveReceipts(nextReceipts);
      setReceipts(nextReceipts);
      setReceipt(nextReceipt);
      setStep('done');
      await refreshStats();
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function downloadReceipt() {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aidshield-donor-receipt-${receipt.tx_hash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyReceipt() {
    if (!receipt) return;
    await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const busy = step === 'building' || step === 'signing' || step === 'submitting';

  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-green mb-4">Donor Escrow Portal</div>
        <h1 className="text-4xl font-bold mb-3">Fund aid publicly. Protect recipients privately.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          Donors can add XLM to the campaign escrow with Freighter, receive a proof-of-impact receipt,
          and verify public capacity while beneficiary identities and credential witnesses remain private.
        </p>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="metric-card">
          <div className="metric-label">Escrow balance</div>
          <div className="metric-value">{stats ? `${stroopsToXlm(stats.escrow_balance)} XLM` : 'Loading'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Payout per claim</div>
          <div className="metric-value">{stats ? `${stroopsToXlm(stats.payout_amount)} XLM` : '...'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Claims paid</div>
          <div className="metric-value">{stats ? stats.claimed_count : '...'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Claims remaining</div>
          <div className="metric-value">{model ? model.remaining.toString() : '...'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">PII exposed</div>
          <div className="metric-value">0</div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Fund Campaign Escrow</h2>
          <div className="space-y-4">
            <div className="privacy-panel">
              <div className="metric-label mb-2">Connected donor</div>
              <div className="mono text-sm">{walletAddress ? shortHex(walletAddress) : 'Not connected'}</div>
            </div>

            <label className="text-sm block">
              <span className="metric-label block mb-2">Amount XLM</span>
              <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" disabled={busy} />
            </label>

            <div className="flex gap-3 flex-wrap">
              <button className="btn-outline" onClick={connect} disabled={busy}>
                {walletAddress ? 'Wallet connected' : 'Connect Freighter'}
              </button>
              <button className="btn-primary" onClick={fund} disabled={busy || !walletAddress}>
                {step === 'building' ? 'Building...'
                  : step === 'signing' ? 'Waiting for signature...'
                  : step === 'submitting' ? 'Submitting...'
                  : step === 'done' ? 'Fund again'
                  : 'Fund campaign'}
              </button>
            </div>

            {!walletInstalled && (
              <div className="text-xs" style={{ color: 'var(--amber)' }}>
                Freighter not detected. Install it from freighter.app and set it to Testnet.
              </div>
            )}
            {error && <div className="text-sm" style={{ color: 'var(--red)' }}>{error}</div>}
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="badge badge-blue mb-3">Proof-of-Impact Receipt</div>
              <h2 className="text-2xl font-bold">Donor funding receipt</h2>
            </div>
            {receipt && (
              <a href={`${EXPLORER_BASE}/tx/${receipt.tx_hash}`} target="_blank" rel="noopener noreferrer" className="btn-outline text-xs">
                Explorer
              </a>
            )}
          </div>

          {receipt ? (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                {[
                  ['Amount', receipt.amount],
                  ['Impact added', receipt.impact_capacity_added],
                  ['Donor', shortHex(receipt.funder_address)],
                  ['Tx', shortHex(receipt.tx_hash)],
                  ['Contract', shortHex(receipt.contract)],
                  ['Root', shortHex(receipt.merkle_root)],
                  ['Funded', new Date(receipt.funded_at).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="data-row">
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span className="mono text-right">{value}</span>
                  </div>
                ))}
              </div>

              <div className="privacy-panel">
                <div className="font-semibold mb-2" style={{ color: 'var(--green-bright)' }}>Receipt privacy statement</div>
                <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>{receipt.privacy_statement}</p>
              </div>

              <div className="flex gap-3 flex-wrap">
                <button className="btn-primary" onClick={downloadReceipt}>Download receipt</button>
                <button className="btn-outline" onClick={copyReceipt}>{copied ? 'Copied' : 'Copy receipt'}</button>
                <Link className="btn-outline" href="/receipt">Inspect receipt</Link>
              </div>
            </div>
          ) : (
            <div className="privacy-panel text-sm leading-7" style={{ color: 'var(--muted)' }}>
              After funding, this panel creates a local donor receipt. The receipt is for donor/auditor proof,
              not beneficiary identification.
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-bold mb-4">Recent local donor receipts</h2>
        {receipts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No donor receipts in this browser yet.</p>
        ) : (
          <div className="space-y-2">
            {receipts.map((item) => (
              <div key={item.tx_hash} className="data-row text-sm">
                <span>{item.amount} funded</span>
                <span className="mono">{shortHex(item.tx_hash)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
