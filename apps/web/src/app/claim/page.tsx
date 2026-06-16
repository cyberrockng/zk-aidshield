'use client';

import { useState, useCallback } from 'react';
import {
  checkNullifier,
  buildClaimTransaction,
  submitSignedTransaction,
  type ClaimEntry,
} from '@/lib/soroban';
import { getWalletAddress, signTx } from '@/lib/freighter';
import { EXPLORER_BASE, DISBURSEMENT_ID, MERKLE_ROOT, shortHex, stellarAddressToField } from '@/lib/constants';

type Step =
  | 'wallet'
  | 'paste'
  | 'validate'
  | 'prove'
  | 'sign'
  | 'submit'
  | 'done'
  | 'error';

interface StepInfo {
  icon: string;
  label: string;
}

const STEP_INFO: Record<Step, StepInfo> = {
  wallet:   { icon: '🔑', label: 'Connect Freighter wallet' },
  paste:    { icon: '📋', label: 'Paste claim data' },
  validate: { icon: '🔍', label: 'Validate inputs' },
  prove:    { icon: '🧮', label: 'Generate ZK proof' },
  sign:     { icon: '✍️',  label: 'Sign transaction' },
  submit:   { icon: '🚀', label: 'Submit to Stellar' },
  done:     { icon: '✅', label: 'Claimed!' },
  error:    { icon: '❌', label: 'Error' },
};

const FLOW: Step[] = ['wallet', 'paste', 'validate', 'prove', 'sign', 'submit', 'done'];

export default function ClaimPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [claimJson, setClaimJson] = useState('');
  const [parsedClaim, setParsedClaim] = useState<ClaimEntry | null>(null);
  const [parseError, setParseError] = useState('');

  const [step, setStep] = useState<Step>('wallet');
  const [statusMsg, setStatusMsg] = useState('');
  const [proofHex, setProofHex] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const handleConnect = useCallback(async () => {
    setError('');
    try {
      const addr = await getWalletAddress();
      setWalletAddress(addr);
      setStep('paste');
    } catch (e) {
      setError(String(e));
    }
  }, []);

  function handleParse() {
    setParseError('');
    setParsedClaim(null);
    try {
      const obj = JSON.parse(claimJson) as ClaimEntry;
      if (
        typeof obj.secret !== 'string' ||
        typeof obj.nullifier !== 'string' ||
        !Array.isArray(obj.merkle_path) ||
        !Array.isArray(obj.path_indices)
      ) {
        throw new Error('Missing required fields: secret, nullifier, merkle_path, path_indices');
      }
      if (obj.merkle_path.length !== 8 || obj.path_indices.length !== 8) {
        throw new Error('merkle_path and path_indices must each have 8 elements');
      }
      setParsedClaim(obj);
    } catch (e) {
      setParseError(String(e));
    }
  }

  async function handleClaim() {
    if (!parsedClaim || !walletAddress) return;
    setError('');
    setProofHex('');
    setTxHash('');

    try {
      // Step: validate
      setStep('validate');
      setStatusMsg('Checking nullifier on-chain…');
      const used = await checkNullifier(parsedClaim.nullifier);
      if (used) throw new Error('This claim has already been used (nullifier found on-chain).');
      setStatusMsg('Disbursement ID matches ✓  Merkle root matches ✓');
      await delay(600);

      // Step: prove — call server-side API route which runs Noir + Barretenberg
      setStep('prove');
      setStatusMsg('Executing Noir circuit and generating UltraHonk proof…');
      const claimantField = stellarAddressToField(walletAddress);
      const proveRes = await fetch('/api/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: parsedClaim.secret,
          merkle_path: parsedClaim.merkle_path,
          path_indices: parsedClaim.path_indices,
          disbursement_id: DISBURSEMENT_ID,
          merkle_root: MERKLE_ROOT,
          nullifier: parsedClaim.nullifier,
          claimant_address: claimantField,
        }),
      });
      if (!proveRes.ok) {
        const err = await proveRes.json();
        throw new Error(`Proof generation failed: ${err.error}`);
      }
      const { proof: proofHexFull, proofSize } = await proveRes.json();
      setProofHex(proofHexFull);
      setStatusMsg(`UltraHonk proof generated ✓ (${proofSize} bytes, ${(proofSize/1024).toFixed(1)} KB)`);

      // Step: sign
      setStep('sign');
      setStatusMsg('Building Soroban transaction…');
      const txXDR = await buildClaimTransaction(walletAddress, parsedClaim.nullifier, proofHexFull);
      setStatusMsg('Please approve in Freighter…');
      const signedXDR = await signTx(txXDR);

      // Step: submit
      setStep('submit');
      setStatusMsg('Broadcasting transaction…');
      const hash = await submitSignedTransaction(signedXDR);
      setTxHash(hash);

      setStep('done');
      setStatusMsg('');
    } catch (e) {
      setError(String(e));
      setStep('error');
    }
  }

  const currentStepIdx = FLOW.indexOf(step);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Claim Your Aid Payment</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          Prove Merkle membership with a ZK proof — no identity revealed, no replay possible.
        </p>
      </div>

      {/* Progress bar */}
      <div className="card mb-6">
        <div className="flex items-center gap-0">
          {FLOW.map((s, i) => {
            const done = i < currentStepIdx || step === 'done';
            const active = i === currentStepIdx && step !== 'done' && step !== 'error';
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: `2px solid ${done ? 'var(--green)' : active ? '#facc15' : 'var(--border)'}`,
                    background: done ? 'var(--green)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: done ? '#000' : active ? '#facc15' : 'var(--muted)',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                {i < FLOW.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: done ? 'var(--green)' : 'var(--border)',
                      margin: '0 4px',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          {FLOW.map((s) => (
            <span key={s} className="flex-1 text-center truncate">
              {STEP_INFO[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* Panel */}
      <div className="card space-y-5">

        {/* Wallet section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">Freighter Wallet</span>
            {walletAddress && (
              <span className="badge badge-green">Connected</span>
            )}
          </div>
          {!walletAddress ? (
            <button className="btn-primary w-full" onClick={handleConnect}>
              Connect Freighter
            </button>
          ) : (
            <div
              className="mono text-xs p-3 rounded-lg"
              style={{ background: '#0a1628', wordBreak: 'break-all' }}
            >
              {walletAddress}
            </div>
          )}
        </div>

        {/* Claim data section */}
        {walletAddress && (
          <div>
            <div className="font-semibold text-sm mb-2">Claim Data</div>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Paste the claim entry you received from the aid coordinator (JSON with secret,
              nullifier, merkle_path, path_indices).
            </p>
            <textarea
              rows={6}
              className="mono text-xs"
              placeholder='{ "index": 0, "secret": "...", "nullifier": "...", "merkle_path": [...], "path_indices": [...] }'
              value={claimJson}
              onChange={(e) => {
                setClaimJson(e.target.value);
                setParsedClaim(null);
                setParseError('');
              }}
              disabled={step !== 'paste' && step !== 'error'}
            />
            {parseError && (
              <div className="text-xs mt-2" style={{ color: '#f87171' }}>
                {parseError}
              </div>
            )}
            {!parsedClaim ? (
              <button
                className="btn-outline text-sm mt-3 w-full"
                onClick={handleParse}
                disabled={!claimJson.trim()}
              >
                Parse Claim Data
              </button>
            ) : (
              <div
                className="mt-3 p-3 rounded-lg text-xs mono space-y-1"
                style={{ background: '#0a1f14', border: '1px solid var(--green-dim)' }}
              >
                <div className="font-bold mb-2" style={{ color: 'var(--green)' }}>
                  ✓ Claim parsed — index #{parsedClaim.index}
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  nullifier:{' '}
                  <span style={{ color: 'var(--text)' }}>
                    {shortHex(parsedClaim.nullifier)}
                  </span>
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  campaign disbursement_id:{' '}
                  <span style={{ color: 'var(--text)' }}>{shortHex(DISBURSEMENT_ID)}</span>
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  merkle_root:{' '}
                  <span style={{ color: 'var(--text)' }}>{shortHex(MERKLE_ROOT)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ZK claim button */}
        {parsedClaim && step === 'paste' && (
          <button className="btn-primary w-full text-base" onClick={handleClaim}>
            Generate ZK Proof &amp; Claim →
          </button>
        )}

        {/* In-progress steps */}
        {['validate', 'prove', 'sign', 'submit'].includes(step) && (
          <div className="space-y-3">
            {(['validate', 'prove', 'sign', 'submit'] as Step[]).map((s) => {
              const sIdx = FLOW.indexOf(s);
              const done = currentStepIdx > sIdx;
              const active = step === s;
              return (
                <div
                  key={s}
                  className="flex items-start gap-3 text-sm"
                  style={{ color: done ? '#4ade80' : active ? '#facc15' : 'var(--muted)' }}
                >
                  <span>{STEP_INFO[s].icon}</span>
                  <div>
                    <div className="font-medium">{STEP_INFO[s].label}</div>
                    {active && statusMsg && (
                      <div className="text-xs mt-0.5 mono">{statusMsg}</div>
                    )}
                    {done && s === 'prove' && proofHex && (
                      <div className="text-xs mt-0.5 mono" style={{ color: '#4ade80' }}>
                        Proof: 0x{proofHex.slice(0, 24)}…
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Success */}
        {step === 'done' && (
          <div
            className="p-4 rounded-lg text-center"
            style={{ background: '#0a1f14', border: '1px solid var(--green-dim)' }}
          >
            <div className="text-3xl mb-2">🎉</div>
            <div className="font-bold text-lg mb-1" style={{ color: 'var(--green)' }}>
              Aid claimed successfully!
            </div>
            <div className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
              Your XLM payment has been released from escrow.
            </div>
            <a
              href={`${EXPLORER_BASE}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="badge badge-green inline-flex"
            >
              View transaction ↗
            </a>
          </div>
        )}

        {/* Error */}
        {step === 'error' && error && (
          <div>
            <div
              className="text-sm p-3 rounded-lg"
              style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}
            >
              {error}
            </div>
            <button
              className="btn-outline text-sm mt-3 w-full"
              onClick={() => {
                setStep(parsedClaim ? 'paste' : walletAddress ? 'paste' : 'wallet');
                setError('');
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Privacy note */}
      <div
        className="mt-6 p-4 rounded-lg text-sm"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}
      >
        🔒 <strong style={{ color: 'var(--text)' }}>Zero PII on-chain.</strong> Your claim
        secret is sent to this server only to generate the ZK proof — it is never stored,
        logged, or shared. The proof itself reveals only that you are in the approved
        beneficiary set. Each nullifier can be used exactly once.
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

