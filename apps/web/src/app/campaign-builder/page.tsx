'use client';

import { useMemo, useState } from 'react';
import { DISBURSEMENT_ID, ISSUER_PUBLIC_KEY, MERKLE_ROOT, stellarAddressToField } from '@/lib/constants';

interface DraftBeneficiary {
  name: string;
  id: string;
  wallet: string;
  valid: boolean;
}

const sampleCsv = `name,id,wallet
Flood Relief Beneficiary A,AID-001,GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ
Flood Relief Beneficiary B,AID-002,GD7KEWXME3KNSEUZIZZZEHTXC5AQCQOZLL2TTKQGR2OBXA2YJBXM7WQS`;

function parseCsv(csv: string): DraftBeneficiary[] {
  const rows = csv.trim().split(/\r?\n/).slice(1);
  return rows
    .map((row) => {
      const [name = '', id = '', wallet = ''] = row.split(',').map((part) => part.trim());
      let valid = false;
      try {
        stellarAddressToField(wallet);
        valid = true;
      } catch {
        valid = false;
      }
      return { name, id, wallet, valid };
    })
    .filter((row) => row.name || row.id || row.wallet);
}

export default function CampaignBuilderPage() {
  const [campaignName, setCampaignName] = useState('Flood Relief Round 1');
  const [payoutXlm, setPayoutXlm] = useState('1');
  const [expiresDays, setExpiresDays] = useState('30');
  const [csv, setCsv] = useState(sampleCsv);
  const [copied, setCopied] = useState(false);

  const beneficiaries = useMemo(() => parseCsv(csv), [csv]);
  const validCount = beneficiaries.filter((row) => row.valid).length;
  const payoutStroops = Math.max(1, Math.round(Number(payoutXlm || 0) * 10_000_000));
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(1, Number(expiresDays || 1)) * 24 * 3600;

  const config = useMemo(() => ({
    campaign_name: campaignName,
    disbursement_id: DISBURSEMENT_ID,
    payout_amount_stroops: payoutStroops,
    expires_at: expiresAt,
    issuer_public_key: ISSUER_PUBLIC_KEY,
    beneficiaries: beneficiaries.map(({ name, id, wallet }) => ({ name, id, wallet })),
  }), [beneficiaries, campaignName, expiresAt, payoutStroops]);

  async function copyConfig() {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function downloadConfig() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beneficiaries.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-blue mb-4">NGO Campaign Builder</div>
        <h1 className="text-4xl font-bold mb-3">Prepare a local campaign without publishing beneficiary PII.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          Build the `beneficiaries.json` input for the existing Merkle generator. Names and internal IDs stay local to the operator;
          only wallet-bound leaves and the Merkle root become part of the ZK campaign.
        </p>
      </section>

      <section className="grid lg:grid-cols-[1fr_0.85fr] gap-5">
        <div className="card space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="metric-label block mb-2">Campaign</span>
              <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="metric-label block mb-2">Payout XLM</span>
              <input value={payoutXlm} onChange={(event) => setPayoutXlm(event.target.value)} inputMode="decimal" />
            </label>
            <label className="text-sm">
              <span className="metric-label block mb-2">Expiry days</span>
              <input value={expiresDays} onChange={(event) => setExpiresDays(event.target.value)} inputMode="numeric" />
            </label>
          </div>

          <label className="text-sm block">
            <span className="metric-label block mb-2">Beneficiary CSV</span>
            <textarea
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              rows={10}
              spellCheck={false}
              className="mono"
            />
          </label>

          <div className="flex gap-3 flex-wrap">
            <button className="btn-primary" onClick={copyConfig}>{copied ? 'Copied' : 'Copy generator JSON'}</button>
            <button className="btn-outline" onClick={downloadConfig}>Download beneficiaries.json</button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Readiness</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card">
                <div className="metric-label">Rows</div>
                <div className="metric-value">{beneficiaries.length}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Valid wallets</div>
                <div className="metric-value">{validCount}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Payout</div>
                <div className="metric-value">{payoutStroops / 10_000_000} XLM</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Current root</div>
                <div className="metric-value">{MERKLE_ROOT.slice(0, 8)}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Next Command</h2>
            <pre className="mono text-xs whitespace-pre-wrap p-3 rounded-md" style={{ background: '#0d1117', border: '1px solid var(--border-dim)' }}>
{`cd packages/merkle-tools
# place this file as beneficiaries.json
npm run build
node --import tsx/esm src/generate-campaign.ts`}
            </pre>
            <p className="text-xs leading-6 mt-3" style={{ color: 'var(--muted)' }}>
              The generated `campaign.json` contains private claim secrets. Keep it local or in server-only env storage.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
