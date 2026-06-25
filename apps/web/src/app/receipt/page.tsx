'use client';

import { useMemo, useState } from 'react';
import { CONTRACT_ID, EXPLORER_BASE, MERKLE_ROOT, VERIFIER_CONTRACT_ID, shortHex } from '@/lib/constants';

const sampleReceipt = {
  version: '1',
  claim_type: 'cash',
  tx_hash: '0000000000000000000000000000000000000000000000000000000000000000',
  nullifier: '1111111111111111111111111111111111111111111111111111111111111111',
  amount: '1 XLM',
  claimed_at: new Date().toISOString(),
  disbursement_contract: CONTRACT_ID,
  verifier_contract: VERIFIER_CONTRACT_ID,
  merkle_root: MERKLE_ROOT,
  public_settlement_fields: ['transaction hash', 'contract id', 'nullifier', 'amount', 'claim route', 'ledger time'],
};

export default function ReceiptPage() {
  const [raw, setRaw] = useState(JSON.stringify(sampleReceipt, null, 2));

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(raw) as Record<string, unknown> };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  }, [raw]);

  const value = parsed.ok ? parsed.value : null;
  const txHash = typeof value?.tx_hash === 'string' ? value.tx_hash : '';

  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-blue mb-4">Proof Receipt</div>
        <h1 className="text-4xl font-bold mb-3">A public receipt without exposing the aid-list witness.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          Paste the JSON receipt downloaded after a successful claim. The receipt links settlement evidence, nullifier,
          Merkle root, and contract IDs while keeping the credential secret and Merkle path private.
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
              {[
                ['Transaction', shortHex(String(value.tx_hash ?? ''))],
                ['Nullifier', shortHex(String(value.nullifier ?? ''))],
                ['Amount', String(value.amount ?? '')],
                ['Claim type', String(value.claim_type ?? '')],
                ['Root', shortHex(String(value.merkle_root ?? ''))],
                ['Contract', shortHex(String(value.disbursement_contract ?? ''))],
                ['Verifier', shortHex(String(value.verifier_contract ?? ''))],
              ].map(([label, display]) => (
                <div key={label} className="data-row">
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span className="mono text-right">{display}</span>
                </div>
              ))}

              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                <div className="privacy-panel">
                  <div className="metric-label mb-2">Proves</div>
                  <div className="text-sm leading-6">A claim settled once against the public campaign state.</div>
                </div>
                <div className="privacy-panel">
                  <div className="metric-label mb-2">Does not reveal</div>
                  <div className="text-sm leading-6">Credential secret, Merkle path, beneficiary name, or ID.</div>
                </div>
              </div>

              {txHash && !/^0+$/.test(txHash) && (
                <a
                  href={`${EXPLORER_BASE}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-4"
                >
                  Open transaction
                </a>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
