'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { decodeCredentialQr, encodeCredentialQr } from '@/lib/credential-qr';
import type { BeneficiaryCredential } from '@/lib/credential';
import { shortHex } from '@/lib/constants';

export default function ClaimPassPage() {
  const [payload, setPayload] = useState('');
  const [credential, setCredential] = useState<BeneficiaryCredential | null>(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');

  const qrPayload = useMemo(() => {
    if (!credential) return '';
    try {
      return encodeCredentialQr(credential);
    } catch {
      return '';
    }
  }, [credential]);

  useEffect(() => {
    if (!qrPayload) {
      setQr('');
      return;
    }
    QRCode.toDataURL(qrPayload, { margin: 1, width: 360, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [qrPayload]);

  async function parsePayload() {
    setError('');
    try {
      const decoded = await decodeCredentialQr(payload);
      setCredential(decoded);
    } catch (err) {
      setCredential(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-green mb-4">Beneficiary Claim Pass</div>
        <h1 className="text-4xl font-bold mb-3">Turn an issued credential into a clean field pass.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          Paste an issued credential JSON or AidShield QR payload. The pass is generated locally in this browser and should
          only be shared with the matching beneficiary wallet.
        </p>
      </section>

      <section className="grid lg:grid-cols-[1fr_0.85fr] gap-5">
        <div className="card">
          <label className="text-sm block">
            <span className="metric-label block mb-2">Credential JSON or QR payload</span>
            <textarea
              rows={14}
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              className="mono"
              placeholder="Paste operator-issued credential here..."
              spellCheck={false}
            />
          </label>
          <div className="flex gap-3 mt-4 flex-wrap">
            <button className="btn-primary" onClick={parsePayload}>Generate pass</button>
            <a className="btn-outline" href="/admin">Issue credential</a>
          </div>
          {error && <div className="mt-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="badge badge-blue mb-3">AidShield Claim Pass</div>
              <h2 className="text-2xl font-bold">Crisis Aid Claim</h2>
            </div>
            <div className="text-right text-xs" style={{ color: 'var(--muted)' }}>Private</div>
          </div>

          {credential ? (
            <div className="space-y-4">
              {qr && (
                <div className="p-4 rounded-md text-center" style={{ background: '#fff' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="Credential QR code" className="mx-auto" width={280} height={280} />
                </div>
              )}
              <div className="space-y-2 text-sm">
                {[
                  ['Wallet', shortHex(credential.claimant_address)],
                  ['Campaign', shortHex(credential.campaign_id)],
                  ['Slot', String(credential.slot_index)],
                  ['Issuer', shortHex(credential.issuer_public_key)],
                  ['Expires', new Date(credential.expires_at * 1000).toLocaleString()],
                ].map(([label, value]) => (
                  <div className="data-row" key={label}>
                    <span style={{ color: 'var(--muted)' }}>{label}</span>
                    <span className="mono">{value}</span>
                  </div>
                ))}
              </div>
              <div className="privacy-panel">
                <div className="font-semibold mb-2" style={{ color: 'var(--amber)' }}>Keep private</div>
                <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>
                  This pass contains the claim witness. It proves eligibility locally and should not be posted publicly.
                </p>
              </div>
            </div>
          ) : (
            <div className="privacy-panel text-sm leading-7" style={{ color: 'var(--muted)' }}>
              Waiting for a valid issued credential. Use `/admin` to issue one, then return here to format the field pass.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
