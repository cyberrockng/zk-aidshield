'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  checkNullifier,
  buildClaimTransaction,
  submitSignedTransaction,
  type ClaimEntry,
} from '@/lib/soroban';
import { isFreighterInstalled, connectWallet, signTx } from '@/lib/freighter';
import { EXPLORER_BASE, DISBURSEMENT_ID, MERKLE_ROOT, shortHex, stellarAddressToField } from '@/lib/constants';
import { generateProof } from '@/lib/prover';
import { verifyCredential, type BeneficiaryCredential } from '@/lib/credential';
import { decodeCredentialQr, prettyCredentialJson } from '@/lib/credential-qr';

type Step = 'wallet' | 'paste' | 'validate' | 'prove' | 'sign' | 'submit' | 'done' | 'error';

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
};

interface ClaimReceipt {
  version: '1';
  tx_hash: string;
  nullifier: string;
  disbursement_id: string;
  merkle_root: string;
  amount: string;
  claimed_at: string;
  slot_index: number;
  issuer_key_id: string;
}

const FLOW_STEPS: Step[] = ['wallet', 'paste', 'validate', 'prove', 'sign', 'submit', 'done'];

const STEP_LABELS: Record<Step, string> = {
  wallet:   'Connect',
  paste:    'Load cred.',
  validate: 'Validate',
  prove:    'Prove',
  sign:     'Sign',
  submit:   'Submit',
  done:     'Done',
  error:    'Error',
};

// ── Proof progress bar ───────────────────────────────────────────────────────
// snarkjs gives no intermediate callbacks during fullProve.
// Asymptotic curve: 50% at 10 s, 80% at 20 s, caps at 95%.

function ProofProgressBar({ statusMsg, startedAt }: { statusMsg: string; startedAt: number }) {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-ms / 14000))));
  const secs = Math.floor(ms / 1000);

  return (
    <div className="mt-3 space-y-2">
      <div style={{ height: 6, background: '#1c2128', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #e3b341, #fde68a)',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{statusMsg}</span>
        <span className="mono text-xs" style={{ color: 'var(--amber)', flexShrink: 0, paddingLeft: 8 }}>
          {secs}s
        </span>
      </div>
      {secs < 5 && (
        <div className="text-xs" style={{ color: '#4b5563', fontStyle: 'italic' }}>
          Groth16 BLS12-381 in WASM — typically 15–30 s on this device
        </div>
      )}
    </div>
  );
}

// ── Proof visual ─────────────────────────────────────────────────────────────

function ProofComputing() {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 rounded-xl"
      style={{ background: '#0d1117', border: '1px solid var(--border-dim)' }}
    >
      <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 16 }}>
        <svg style={{ position: 'absolute', inset: 0, animation: 'spin-ring 2.5s linear infinite' }} viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="32" fill="none" stroke="var(--border-dim)" strokeWidth="3" />
          <circle cx="36" cy="36" r="32" fill="none" stroke="var(--amber)" strokeWidth="3" strokeDasharray="30 170" strokeLinecap="round" />
        </svg>
        <svg style={{ position: 'absolute', inset: 8, animation: 'counter-ring 1.8s linear infinite' }} viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border-dim)" strokeWidth="2" />
          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(63,185,80,0.6)" strokeWidth="2" strokeDasharray="20 118" strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
          ⚡
        </div>
      </div>
      <div className="font-semibold text-sm mb-1" style={{ color: 'var(--amber)' }}>
        Generating Groth16 proof…
      </div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        BLS12-381 witness + proof computation in WASM
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClaimPage() {
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const [credJson, setCredJson] = useState('');
  const [parsedCred, setParsedCred] = useState<BeneficiaryCredential | null>(null);
  const [parseError, setParseError] = useState('');
  const [qrScanError, setQrScanError] = useState('');
  const [qrScanBusy, setQrScanBusy] = useState(false);
  const [qrPassphrase, setQrPassphrase] = useState('');

  const [step, setStep] = useState<Step>('wallet');
  const [statusMsg, setStatusMsg] = useState('');
  const [proofHex, setProofHex] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [claimReceipt, setClaimReceipt] = useState<ClaimReceipt | null>(null);
  const [receiptCopied, setReceiptCopied] = useState(false);
  const proveStartedAt = useRef<number>(0);

  useEffect(() => {
    isFreighterInstalled().then(setWalletInstalled);
  }, []);

  const handleConnect = useCallback(async () => {
    setError('');
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
      setStep('paste');
    } catch (e) {
      setError(String(e));
    }
  }, []);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCredJson((ev.target?.result as string) ?? '');
      setParsedCred(null);
      setParseError('');
    };
    reader.readAsText(file);
  }

  async function handleQrImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;

    setQrScanError('');
    setParseError('');
    setParsedCred(null);
    setQrScanBusy(true);

    try {
      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Detector) {
        throw new Error('QR image scanning is not available in this browser. Use Chrome/Edge, or paste the QR payload text.');
      }

      const detector = new Detector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const raw = codes.find((c) => c.rawValue)?.rawValue;
      if (!raw) throw new Error('No QR credential found in this image.');

      const credential = await decodeCredentialQr(raw, qrPassphrase);
      setCredJson(prettyCredentialJson(credential));
      setStatusMsg('QR credential imported');
      setStep('paste');
    } catch (err) {
      setQrScanError(String(err));
    } finally {
      setQrScanBusy(false);
    }
  }

  async function handleParse() {
    setParseError('');
    setParsedCred(null);
    if (!walletAddress) return;

    let obj: BeneficiaryCredential;
    try {
      obj = await decodeCredentialQr(credJson, qrPassphrase);
    } catch (e) {
      setParseError(`Credential parse error: ${String(e)}`);
      return;
    }

    // Validate credential signature and binding
    const err = await verifyCredential(obj, walletAddress);
    if (err) {
      setParseError(err);
      return;
    }

    setParsedCred(obj);
  }

  async function handleClaim() {
    if (!parsedCred || !walletAddress) return;
    setError('');
    setProofHex('');
    setTxHash('');
    setClaimReceipt(null);

    const claimEntry: ClaimEntry = {
      index: parsedCred.leaf_index,
      secret: parsedCred.secret,
      leaf: '', // not needed by prover
      merkle_path: parsedCred.merkle_path,
      path_indices: parsedCred.path_indices,
    };

    try {
      setStep('validate');
      setStatusMsg('Verifying disbursement ID and Merkle root…');
      await delay(400);

      setStep('prove');
      proveStartedAt.current = Date.now();
      setStatusMsg('Computing Poseidon nullifier…');
      const claimantField = stellarAddressToField(walletAddress);
      const { proof: proofHexFull, nullifier: derivedNullifier, proofSize } =
        await generateProof(
          {
            secret: claimEntry.secret,
            merkle_path: claimEntry.merkle_path,
            path_indices: claimEntry.path_indices,
            disbursement_id: DISBURSEMENT_ID,
            merkle_root: MERKLE_ROOT,
            claimant_address: claimantField,
            expires_at: parsedCred.expires_at,
            issuer_key_id: parsedCred.issuer_key_id,
          },
          setStatusMsg,
        );
      setProofHex(proofHexFull);
      setStatusMsg(`Groth16 proof generated ✓  (${proofSize} bytes)`);

      const used = await checkNullifier(derivedNullifier);
      if (used) throw new Error('This claim has already been used — nullifier found on-chain.');

      setStep('sign');
      setStatusMsg('Building Soroban transaction…');
      const txXDR = await buildClaimTransaction(
        walletAddress,
        derivedNullifier,
        proofHexFull,
        parsedCred.expires_at,
        parsedCred.issuer_key_id,
      );
      setStatusMsg('Please approve in Freighter…');
      const signedXDR = await signTx(txXDR, walletAddress);

      setStep('submit');
      setStatusMsg('Broadcasting to Stellar testnet…');
      const hash = await submitSignedTransaction(signedXDR);
      setTxHash(hash);
      setClaimReceipt({
        version: '1',
        tx_hash: hash,
        nullifier: derivedNullifier,
        disbursement_id: DISBURSEMENT_ID,
        merkle_root: MERKLE_ROOT,
        amount: '1 XLM',
        claimed_at: new Date().toISOString(),
        slot_index: parsedCred.slot_index,
        issuer_key_id: parsedCred.issuer_key_id,
      });

      setStep('done');
      setStatusMsg('');
    } catch (e) {
      setError(String(e));
      setStep('error');
    }
  }

  const currentStepIdx = FLOW_STEPS.indexOf(step);

  function handleDownloadReceipt() {
    if (!claimReceipt) return;
    const blob = new Blob([JSON.stringify(claimReceipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aidshield-claim-receipt-${claimReceipt.tx_hash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopyReceipt() {
    if (!claimReceipt) return;
    await navigator.clipboard.writeText(JSON.stringify(claimReceipt, null, 2));
    setReceiptCopied(true);
    setTimeout(() => setReceiptCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto">

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1.5" style={{ letterSpacing: '-0.02em' }}>
          Claim Your Aid Payment
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Present your operator-issued credential. A Groth16 BLS12-381 proof is generated in your
          browser — no identity revealed, no replay possible.
        </p>
      </div>

      {/* ── Step tracker ── */}
      <div className="mb-6 px-5 py-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-dim)' }}>
        <div className="flex items-center">
          {FLOW_STEPS.map((s, i) => {
            const done = i < currentStepIdx || step === 'done';
            const active = i === currentStepIdx && step !== 'done' && step !== 'error';
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: `2px solid ${done ? 'var(--green)' : active ? 'var(--amber)' : 'var(--border)'}`,
                  background: done ? 'var(--green)' : active ? 'rgba(227,179,65,0.12)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 700,
                  color: done ? '#04080e' : active ? 'var(--amber)' : 'var(--muted)',
                  flexShrink: 0, transition: 'all 0.2s',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div style={{
                    flex: 1, height: 2,
                    background: done ? 'var(--green-dim)' : 'var(--border-dim)',
                    margin: '0 3px', transition: 'background 0.3s',
                  }} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2">
          {FLOW_STEPS.map((s, i) => {
            const done = i < currentStepIdx || step === 'done';
            const active = i === currentStepIdx && step !== 'done' && step !== 'error';
            return (
              <span key={s} className="flex-1 text-center truncate" style={{
                fontSize: '0.62rem', fontWeight: active ? 700 : 400,
                color: done ? 'var(--green)' : active ? 'var(--amber)' : 'var(--muted)',
                transition: 'color 0.2s',
              }}>
                {STEP_LABELS[s]}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div className="rounded-xl p-6 space-y-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-dim)' }}>

        {/* Wallet */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">Freighter Wallet</span>
            {walletAddress && <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Connected</span>}
          </div>
          {!walletAddress ? (
            <div className="space-y-3">
              <button className="btn-primary w-full" onClick={handleConnect}>
                Connect Freighter
              </button>
              {walletInstalled === false && (
                <p className="text-xs" style={{ color: 'var(--red)' }}>
                  Freighter not detected —{' '}
                  <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="underline">
                    install the extension
                  </a>{' '}
                  and reload.
                </p>
              )}
            </div>
          ) : (
            <div className="mono text-xs px-3 py-2.5 rounded-lg" style={{ background: '#0d1117', border: '1px solid var(--border-dim)', wordBreak: 'break-all', color: 'var(--muted-2)' }}>
              {walletAddress}
            </div>
          )}
        </div>

        {/* Credential */}
        {walletAddress && (
          <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '1.5rem' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Beneficiary Credential</span>
            </div>

            <div
              className="text-xs px-4 py-3 rounded-lg mb-3 leading-relaxed"
              style={{ background: 'rgba(63,185,80,0.04)', border: '1px solid var(--border-dim)', color: 'var(--muted)' }}
            >
              Your credential was issued by the aid operator. It is signed and bound to this wallet
              address — it cannot be used by anyone else, and the secret inside never leaves your device.
            </div>

            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
              QR passphrase
            </label>
            <input
              type="password"
              value={qrPassphrase}
              onChange={(e) => { setQrPassphrase(e.target.value); setParseError(''); setQrScanError(''); }}
              placeholder="Required for encrypted QR payloads"
              className="text-sm mb-3"
              autoComplete="current-password"
              disabled={step !== 'paste' && step !== 'error'}
            />

            {/* File upload */}
            <label
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg cursor-pointer mb-3 text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-2)', border: '1px dashed var(--border)', color: 'var(--muted-2)' }}
            >
              <input type="file" accept=".json" className="sr-only" onChange={handleFileUpload} disabled={step !== 'paste' && step !== 'error'} />
              Upload credential file (.json)
            </label>

            <label
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg cursor-pointer mb-3 text-sm font-medium transition-colors"
              style={{ background: 'rgba(63,185,80,0.06)', border: '1px dashed rgba(63,185,80,0.3)', color: 'var(--green-bright)' }}
            >
              <input type="file" accept="image/*" className="sr-only" onChange={handleQrImageUpload} disabled={qrScanBusy || (step !== 'paste' && step !== 'error')} />
              {qrScanBusy ? 'Scanning QR…' : 'Scan credential QR image'}
            </label>

            {qrScanError && (
              <div className="text-xs mb-3 p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid rgba(248,81,73,0.25)' }}>
                {qrScanError}
              </div>
            )}

            <div className="text-xs text-center mb-3" style={{ color: 'var(--muted)' }}>or paste JSON / QR payload directly</div>

            <textarea
              rows={5}
              className="mono text-xs"
              placeholder='aidshield:credential:v2:… or { "version": "2", "claimant_address": "G…", "secret": "…", … }'
              value={credJson}
              onChange={(e) => { setCredJson(e.target.value); setParsedCred(null); setParseError(''); }}
              disabled={step !== 'paste' && step !== 'error'}
            />

            {parseError && (
              <div className="text-xs mt-2 p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid rgba(248,81,73,0.25)' }}>
                {parseError}
              </div>
            )}

            {!parsedCred ? (
              <button
                className="btn-outline text-sm mt-3 w-full"
                onClick={handleParse}
                disabled={!credJson.trim()}
              >
                Verify &amp; Load Credential
              </button>
            ) : (
              <div
                className="mt-3 p-3 rounded-lg text-xs mono space-y-1"
                style={{ background: 'var(--green-subtle)', border: '1px solid rgba(63,185,80,0.2)' }}
              >
                <div className="font-bold mb-2" style={{ color: 'var(--green-bright)' }}>
                  ✓ Credential verified — slot #{parsedCred.slot_index}
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  issuer: <span style={{ color: 'var(--muted-2)' }}>{shortHex(parsedCred.issuer_public_key)}</span>
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  bound to: <span style={{ color: 'var(--muted-2)' }}>{parsedCred.claimant_address.slice(0, 10)}…</span>
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  expires: <span style={{ color: 'var(--muted-2)' }}>{new Date(parsedCred.expires_at * 1000).toLocaleDateString()}</span>
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  issuer key: <span style={{ color: 'var(--muted-2)' }}>{shortHex(parsedCred.issuer_key_id)}</span>
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  nullifier: <span style={{ fontStyle: 'italic' }}>computed from wallet at claim time</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        {parsedCred && step === 'paste' && (
          <button
            className="btn-primary w-full text-base"
            onClick={handleClaim}
            style={{ padding: '0.8rem', fontSize: '0.95rem' }}
          >
            Generate ZK Proof &amp; Claim →
          </button>
        )}

        {/* In-progress */}
        {(['validate', 'prove', 'sign', 'submit'] as Step[]).some((s) => s === step) && (
          <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '1.5rem' }}>
            {step === 'prove' && <ProofComputing />}
            {step === 'prove' && (
              <ProofProgressBar statusMsg={statusMsg} startedAt={proveStartedAt.current} />
            )}
            {(['validate', 'sign', 'submit'] as Step[]).map((s) => {
              const sIdx = FLOW_STEPS.indexOf(s);
              const done = currentStepIdx > sIdx;
              const active = step === s;
              if (!done && !active) return null;
              return (
                <div key={s} className="flex items-start gap-3 text-sm mt-3" style={{ color: done ? 'var(--green-bright)' : active ? 'var(--amber)' : 'var(--muted)' }}>
                  <span className="mt-0.5">{done ? '✓' : active ? '›' : '○'}</span>
                  <div>
                    <div className="font-medium">{STEP_LABELS[s]}</div>
                    {active && statusMsg && (
                      <div className="mono text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{statusMsg}</div>
                    )}
                  </div>
                </div>
              );
            })}
            {(['sign', 'submit'] as Step[]).includes(step) && proofHex && (
              <div className="mt-3 p-3 rounded-lg mono text-xs" style={{ background: 'var(--green-subtle)', border: '1px solid rgba(63,185,80,0.15)', color: 'var(--green-bright)' }}>
                ✓ Groth16 proof (384 bytes): 0x{proofHex.slice(0, 24)}…
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {step === 'done' && (
          <div
            className="rounded-xl text-center py-10 px-6"
            style={{ background: 'linear-gradient(135deg, var(--green-subtle) 0%, #0c1726 100%)', border: '1px solid rgba(63,185,80,0.25)' }}
          >
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
            <div className="font-bold text-xl mb-2" style={{ color: 'var(--green-bright)' }}>Aid claimed!</div>
            <div className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
              Your XLM payment has been released from escrow.
            </div>
            <div className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
              Nullifier is now on-chain — this claim cannot be replayed.
            </div>
            <a
              href={`${EXPLORER_BASE}/tx/${txHash}`}
              target="_blank" rel="noopener noreferrer"
              className="badge badge-green"
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            >
              View transaction on Stellar Expert ↗
            </a>
            {claimReceipt && (
              <div className="mt-5 mx-auto text-left rounded-lg p-4" style={{ maxWidth: 460, background: '#06110a', border: '1px solid rgba(63,185,80,0.2)' }}>
                <div className="font-semibold text-sm mb-2" style={{ color: 'var(--green-bright)' }}>
                  Private claim receipt
                </div>
                <div className="mono text-xs space-y-1" style={{ color: 'var(--muted)' }}>
                  <div>tx: {shortHex(claimReceipt.tx_hash)}</div>
                  <div>nullifier: {shortHex(claimReceipt.nullifier)}</div>
                  <div>amount: {claimReceipt.amount}</div>
                  <div>claimed: {new Date(claimReceipt.claimed_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'var(--green-dim)', color: 'var(--green-bright)', border: '1px solid rgba(63,185,80,0.3)' }}
                    onClick={handleDownloadReceipt}
                  >
                    Download receipt
                  </button>
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--muted-2)', border: '1px solid var(--border)' }}
                    onClick={handleCopyReceipt}
                  >
                    {receiptCopied ? 'Copied!' : 'Copy receipt'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {step === 'error' && error && (
          <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '1.5rem' }}>
            <div className="text-sm p-4 rounded-lg" style={{ background: '#110d0d', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.3)' }}>
              {error}
            </div>
            <button
              className="btn-outline text-sm mt-3 w-full"
              onClick={() => { setStep(parsedCred ? 'paste' : 'wallet'); setError(''); }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Privacy note */}
      <div className="mt-5 px-5 py-4 rounded-xl text-sm leading-relaxed" style={{ background: 'var(--surface)', border: '1px solid var(--border-dim)', color: 'var(--muted)' }}>
        <span style={{ color: 'var(--green-bright)', fontWeight: 600 }}>Your secret never leaves this device.</span>{' '}
        Groth16 proof generation runs entirely in your browser via WebAssembly. No server sees your
        claim secret or can link you to a beneficiary. The proof reveals only that you belong to the
        approved Merkle set. Each nullifier is wallet-bound and single-use, enforced on-chain forever.{' '}
        <a href="/audit" className="underline" style={{ color: 'var(--green)' }}>
          Full trust model →
        </a>
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
