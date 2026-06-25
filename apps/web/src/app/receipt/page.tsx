'use client';

import { useMemo, useState } from 'react';
import { CONTRACT_ID, EXPLORER_BASE, MERKLE_ROOT, VERIFIER_CONTRACT_ID, shortHex } from '@/lib/constants';

const sampleReceipt = {
  version: '1',
  type: 'donor_funding_receipt',
  tx_hash: '0000000000000000000000000000000000000000000000000000000000000000',
  amount: '1 XLM',
  funded_at: new Date().toISOString(),
  funder_address: 'G...',
  contract: CONTRACT_ID,
  verifier_contract: VERIFIER_CONTRACT_ID,
  merkle_root: MERKLE_ROOT,
  impact_capacity_added: '1 private claim',
  privacy_statement: 'Donor funding is public. Beneficiary identities, credentials, and Merkle witnesses remain hidden.',
  public_settlement_fields: ['donor wallet', 'transaction hash', 'amount', 'contract id', 'ledger time'],
};

export default function ReceiptPage() {
  const [raw, setRaw] = useState(JSON.stringify(sampleReceipt, null, 2));
  const [verifyState, setVerifyState] = useState<
    | { status: 'idle' }
    | { status: 'checking' }
    | { status: 'success'; message: string; explorerUrl: string }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(raw) as Record<string, unknown> };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }, [raw]);

  const value = parsed.ok ? parsed.value : null;
  const txHash = typeof value?.tx_hash === 'string' ? value.tx_hash : '';
  const canVerifyTx = /^[a-f0-9]{64}$/i.test(txHash) && !/^0+$/.test(txHash);
  const receiptType = String(value?.type ?? (value?.claim_type ? 'claim_receipt' : 'unknown'));
  const isDonorReceipt = receiptType === 'donor_funding_receipt';
  const summaryRows = value
    ? isDonorReceipt
      ? [
          ['Receipt type', 'Donor funding'],
          ['Transaction', shortHex(String(value.tx_hash ?? ''))],
          ['Amount', String(value.amount ?? '')],
          ['Impact added', String(value.impact_capacity_added ?? '')],
          ['Donor', shortHex(String(value.funder_address ?? ''))],
          ['Root', shortHex(String(value.merkle_root ?? ''))],
          ['Contract', shortHex(String(value.contract ?? value.disbursement_contract ?? ''))],
          ['Funded', value.funded_at ? new Date(String(value.funded_at)).toLocaleString() : ''],
        ]
      : [
          ['Receipt type', 'Private claim'],
          ['Transaction', shortHex(String(value.tx_hash ?? ''))],
          ['Nullifier', shortHex(String(value.nullifier ?? ''))],
          ['Amount', String(value.amount ?? '')],
          ['Claim type', String(value.claim_type ?? '')],
          ['Root', shortHex(String(value.merkle_root ?? ''))],
          ['Contract', shortHex(String(value.disbursement_contract ?? value.contract ?? ''))],
          ['Verifier', shortHex(String(value.verifier_contract ?? ''))],
        ]
    : [];

  async function verifyReceiptTransaction() {
    if (!canVerifyTx) return;
    setVerifyState({ status: 'checking' });
    try {
      const response = await fetch('/api/verify-receipt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tx_hash: txHash }),
      });
      const data = await response.json() as { error?: string; status?: string; verified?: boolean; explorer_url?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? `Receipt verification failed with HTTP ${response.status}`);
      setVerifyState({
        status: data.verified ? 'success' : 'error',
        message: data.verified ? `Verified on Stellar testnet: ${data.status}` : `Transaction found but not successful: ${data.status}`,
        explorerUrl: data.explorer_url ?? `${EXPLORER_BASE}/tx/${txHash}`,
      });
    } catch (error) {
      setVerifyState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-blue mb-4">Proof Receipt</div>
        <h1 className="text-4xl font-bold mb-3">A public receipt without exposing the aid-list witness.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          Paste a beneficiary claim receipt or donor funding receipt. Receipts link settlement evidence, campaign anchors,
          and public impact without exposing credential secrets, Merkle paths, names, or IDs.
        </p>
      </section>

      <section className="grid lg:grid-cols-[1fr_0.85fr] gap-5">
        <div className="card">
          <label className="text-sm block">
            <span className="metric-label block mb-2">Receipt JSON</span>
            <textarea value={raw} onChange={(event) => setRaw(event.target.value)} rows={16} className="mono" spellCheck={false} />
          </label>
          {!parsed.ok && <div className="mt-4 text-sm" style={{ color: 'var(--red)' }}>{parsed.error}</div>}
        </div>

        <div className="card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-2xl font-bold">Receipt Summary</h2>
            <span className={`badge ${parsed.ok ? 'badge-green' : 'badge-red'}`}>{parsed.ok ? 'Valid JSON' : 'Invalid'}</span>
          </div>

          {value && (
            <div className="space-y-3 text-sm">
              {summaryRows.map(([label, display]) => (
                <div key={label} className="data-row">
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span className="mono text-right">{display}</span>
                </div>
              ))}

              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                <div className="privacy-panel">
                  <div className="metric-label mb-2">Proves</div>
                  <div className="text-sm leading-6">
                    {isDonorReceipt
                      ? 'Aid escrow was funded through a public Stellar transaction.'
                      : 'A claim settled once against the public campaign state.'}
                  </div>
                </div>
                <div className="privacy-panel">
                  <div className="metric-label mb-2">Does not reveal</div>
                  <div className="text-sm leading-6">
                    {isDonorReceipt
                      ? 'Beneficiary names, IDs, claim witnesses, or eligibility-list membership.'
                      : 'Credential secret, Merkle path, beneficiary name, or ID.'}
                  </div>
                </div>
              </div>

              {canVerifyTx && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={verifyReceiptTransaction}
                      disabled={verifyState.status === 'checking'}
                      className="btn-primary"
                    >
                      {verifyState.status === 'checking' ? 'Checking...' : 'Verify on Stellar'}
                    </button>
                    <a
                      href={`${EXPLORER_BASE}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline"
                    >
                      Open transaction
                    </a>
                  </div>
                  {verifyState.status !== 'idle' && verifyState.status !== 'checking' && (
                    <div className={`badge ${verifyState.status === 'success' ? 'badge-green' : 'badge-red'}`}>
                      {verifyState.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
