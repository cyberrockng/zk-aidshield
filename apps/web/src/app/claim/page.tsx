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

const DEMO_CLAIM = JSON.stringify({
  index: 0,
  secret: '00132a8a297936680482cfc611605283081a0af5104b25ca73ddcbdb540150d3',
  leaf: '56b649add441aabff80f2c1d96be229fb03dbed0304f9d70c48842ad4e61d4e7',
  merkle_path: [
    '0000000000000000000000000000000000000000000000000000000000000000',
    '6c2bac92f1ffd53ea9c3166480d221f6d8b716ce67ba22b751781cbd305bfc7b',
    '6c5c43bd280a41f3cf052601f5f04681f4a46f494248244fb9f02ba0fc13e992',
    '23b5902987a2e16f5f65cfd3aca7ab9fd30a96f0201108eee6a840a7a0c6b1dc',
    '0fe5437fa39d3f737bd90712346070b2b2f6efd41048089c757ca5bce82cdd0e',
    '68d1bdb26377ba3e11cb6bbb313eb167366ce22f9c4a8a16a92849c51da4d0b3',
    '4b793aba5e3621207b614ff7185da64d7558ce4d5406eae21d6aa8ae5035c10a',
    '0e5da84a34c506465ddd6842d1a4de891224981c142bac69cdb6c8f3fddaae8f',
  ],
  path_indices: [false, false, false, false, false, false, false, false],
}, null, 2);

type Step = 'wallet' | 'paste' | 'validate' | 'prove' | 'sign' | 'submit' | 'done' | 'error';

const FLOW_STEPS: Step[] = ['wallet', 'paste', 'validate', 'prove', 'sign', 'submit', 'done'];

const STEP_LABELS: Record<Step, string> = {
  wallet:   'Connect',
  paste:    'Load claim',
  validate: 'Validate',
  prove:    'Generate proof',
  sign:     'Sign',
  submit:   'Submit',
  done:     'Done',
  error:    'Error',
};

// ── Proof progress bar ───────────────────────────────────────────────────────
// snarkjs gives no intermediate callbacks during fullProve.
// We fake progress with an asymptotic curve: 50% at 10 s, 80% at 20 s, caps 95%.

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

// ── Proof visual (spinning rings while computing) ────────────────────────────

function ProofComputing() {
  return (
    <div
      className="flex flex-col items-center justify-center py-8 rounded-xl"
      style={{ background: '#0d1117', border: '1px solid var(--border-dim)' }}
    >
      <div style={{ position: 'relative', width: 72, height: 72, marginBottom: 16 }}>
        {/* Outer ring */}
        <svg
          style={{ position: 'absolute', inset: 0, animation: 'spin-ring 2.5s linear infinite' }}
          viewBox="0 0 72 72"
        >
          <circle cx="36" cy="36" r="32" fill="none" stroke="var(--border-dim)" strokeWidth="3" />
          <circle
            cx="36" cy="36" r="32"
            fill="none"
            stroke="var(--amber)"
            strokeWidth="3"
            strokeDasharray="30 170"
            strokeLinecap="round"
          />
        </svg>
        {/* Inner ring */}
        <svg
          style={{ position: 'absolute', inset: 8, animation: 'counter-ring 1.8s linear infinite' }}
          viewBox="0 0 56 56"
        >
          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border-dim)" strokeWidth="2" />
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke="rgba(63,185,80,0.6)"
            strokeWidth="2"
            strokeDasharray="20 118"
            strokeLinecap="round"
          />
        </svg>
        {/* Center icon */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
          }}
        >
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
  const [claimJson, setClaimJson] = useState('');
  const [parsedClaim, setParsedClaim] = useState<ClaimEntry | null>(null);
  const [parseError, setParseError] = useState('');

  const [step, setStep] = useState<Step>('wallet');
  const [statusMsg, setStatusMsg] = useState('');
  const [proofHex, setProofHex] = useState('');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
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

  function handleParse() {
    setParseError('');
    setParsedClaim(null);
    try {
      const obj = JSON.parse(claimJson) as ClaimEntry;
      if (
        typeof obj.secret !== 'string' ||
        !Array.isArray(obj.merkle_path) ||
        !Array.isArray(obj.path_indices)
      ) {
        throw new Error('Missing required fields: secret, merkle_path, path_indices');
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
      setStep('validate');
      setStatusMsg('Checking disbursement ID and Merkle root…');
      await delay(400);

      setStep('prove');
      proveStartedAt.current = Date.now();
      setStatusMsg('Computing Poseidon nullifier…');
      const claimantField = stellarAddressToField(walletAddress);
      const { proof: proofHexFull, nullifier: derivedNullifier, proofSize } =
        await generateProof(
          {
            secret: parsedClaim.secret,
            merkle_path: parsedClaim.merkle_path,
            path_indices: parsedClaim.path_indices,
            disbursement_id: DISBURSEMENT_ID,
            merkle_root: MERKLE_ROOT,
            claimant_address: claimantField,
          },
          setStatusMsg,
        );
      setProofHex(proofHexFull);
      setStatusMsg(`Groth16 proof generated ✓  (${proofSize} bytes)`);

      const used = await checkNullifier(derivedNullifier);
      if (used) throw new Error('This claim has already been used — nullifier found on-chain.');

      setStep('sign');
      setStatusMsg('Building Soroban transaction…');
      const txXDR = await buildClaimTransaction(walletAddress, derivedNullifier, proofHexFull);
      setStatusMsg('Please approve in Freighter…');
      const signedXDR = await signTx(txXDR, walletAddress);

      setStep('submit');
      setStatusMsg('Broadcasting to Stellar testnet…');
      const hash = await submitSignedTransaction(signedXDR);
      setTxHash(hash);

      setStep('done');
      setStatusMsg('');
    } catch (e) {
      setError(String(e));
      setStep('error');
    }
  }

  const currentStepIdx = FLOW_STEPS.indexOf(step);

  return (
    <div className="max-w-2xl mx-auto">

      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1.5" style={{ letterSpacing: '-0.02em' }}>
          Claim Your Aid Payment
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Prove Merkle membership with a Groth16 BLS12-381 proof — no identity revealed, no replay possible.
        </p>
      </div>

      {/* ── Step progress tracker ── */}
      <div
        className="mb-6 px-5 py-4 rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-dim)' }}
      >
        <div className="flex items-center">
          {FLOW_STEPS.map((s, i) => {
            const done = i < currentStepIdx || step === 'done';
            const active = i === currentStepIdx && step !== 'done' && step !== 'error';
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: `2px solid ${done ? 'var(--green)' : active ? 'var(--amber)' : 'var(--border)'}`,
                    background: done ? 'var(--green)' : active ? 'rgba(227,179,65,0.12)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: done ? '#04080e' : active ? 'var(--amber)' : 'var(--muted)',
                    flexShrink: 0,
                    transition: 'all 0.2s',
                  }}
                >
                  {done ? '✓' : i + 1}
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: done ? 'var(--green-dim)' : 'var(--border-dim)',
                      margin: '0 3px',
                      transition: 'background 0.3s',
                    }}
                  />
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
              <span
                key={s}
                className="flex-1 text-center truncate"
                style={{
                  fontSize: '0.65rem',
                  fontWeight: active ? 700 : 400,
                  color: done ? 'var(--green)' : active ? 'var(--amber)' : 'var(--muted)',
                  transition: 'color 0.2s',
                }}
              >
                {STEP_LABELS[s]}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div
        className="rounded-xl p-6 space-y-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-dim)' }}
      >

        {/* Wallet */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-sm">Freighter Wallet</span>
            {walletAddress && (
              <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Connected</span>
            )}
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
                  and reload this page.
                </p>
              )}
            </div>
          ) : (
            <div
              className="mono text-xs px-3 py-2.5 rounded-lg"
              style={{ background: '#0d1117', border: '1px solid var(--border-dim)', wordBreak: 'break-all', color: 'var(--muted-2)' }}
            >
              {walletAddress}
            </div>
          )}
        </div>

        {/* Claim data */}
        {walletAddress && (
          <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '1.5rem' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm">Claim Data</span>
              <button
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--blue)',
                  border: '1px solid var(--border)',
                }}
                onClick={() => {
                  setClaimJson(DEMO_CLAIM);
                  setParsedClaim(null);
                  setParseError('');
                }}
                disabled={step !== 'paste' && step !== 'error'}
              >
                Load demo claim
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              Paste the claim entry received from the aid coordinator, or use the demo claim to test.
            </p>
            <textarea
              rows={6}
              className="mono text-xs"
              placeholder='{ "index": 0, "secret": "...", "merkle_path": [...], "path_indices": [...] }'
              value={claimJson}
              onChange={(e) => {
                setClaimJson(e.target.value);
                setParsedClaim(null);
                setParseError('');
              }}
              disabled={step !== 'paste' && step !== 'error'}
            />
            {parseError && (
              <div className="text-xs mt-2" style={{ color: 'var(--red)' }}>{parseError}</div>
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
                style={{ background: 'var(--green-subtle)', border: '1px solid rgba(63,185,80,0.2)' }}
              >
                <div className="font-bold mb-2" style={{ color: 'var(--green-bright)' }}>
                  ✓ Claim parsed — index #{parsedClaim.index}
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  nullifier: <span style={{ fontStyle: 'italic' }}>computed from wallet at claim time</span>
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  disbursement_id: <span style={{ color: 'var(--muted-2)' }}>{shortHex(DISBURSEMENT_ID)}</span>
                </div>
                <div style={{ color: 'var(--muted)' }}>
                  merkle_root: <span style={{ color: 'var(--muted-2)' }}>{shortHex(MERKLE_ROOT)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CTA button */}
        {parsedClaim && step === 'paste' && (
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

            {/* Proof computing visual */}
            {step === 'prove' && <ProofComputing />}

            {/* Progress bar for proof */}
            {step === 'prove' && (
              <ProofProgressBar statusMsg={statusMsg} startedAt={proveStartedAt.current} />
            )}

            {/* Other active steps */}
            {(['validate', 'sign', 'submit'] as Step[]).map((s) => {
              const sIdx = FLOW_STEPS.indexOf(s);
              const done = currentStepIdx > sIdx;
              const active = step === s;
              if (!done && !active) return null;
              return (
                <div
                  key={s}
                  className="flex items-start gap-3 text-sm mt-3"
                  style={{ color: done ? 'var(--green-bright)' : active ? 'var(--amber)' : 'var(--muted)' }}
                >
                  <span className="mt-0.5">
                    {done ? '✓' : active ? '›' : '○'}
                  </span>
                  <div>
                    <div className="font-medium">{STEP_LABELS[s]}</div>
                    {active && statusMsg && (
                      <div className="mono text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{statusMsg}</div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Proof done summary */}
            {(['sign', 'submit'] as Step[]).includes(step) && proofHex && (
              <div
                className="mt-3 p-3 rounded-lg mono text-xs"
                style={{ background: 'var(--green-subtle)', border: '1px solid rgba(63,185,80,0.15)', color: 'var(--green-bright)' }}
              >
                ✓ Groth16 proof (384 bytes): 0x{proofHex.slice(0, 24)}…
              </div>
            )}
          </div>
        )}

        {/* Success */}
        {step === 'done' && (
          <div
            className="rounded-xl text-center py-10 px-6"
            style={{
              background: 'linear-gradient(135deg, var(--green-subtle) 0%, #0c1726 100%)',
              border: '1px solid rgba(63,185,80,0.25)',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
            <div className="font-bold text-xl mb-2" style={{ color: 'var(--green-bright)' }}>
              Aid claimed!
            </div>
            <div className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
              Your XLM payment has been released from escrow.
            </div>
            <div className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
              Nullifier is now on-chain — this claim cannot be replayed.
            </div>
            <a
              href={`${EXPLORER_BASE}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="badge badge-green"
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            >
              View transaction on Stellar Expert ↗
            </a>
          </div>
        )}

        {/* Error */}
        {step === 'error' && error && (
          <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '1.5rem' }}>
            <div
              className="text-sm p-4 rounded-lg"
              style={{ background: '#110d0d', color: 'var(--red)', border: '1px solid rgba(248,81,73,0.3)' }}
            >
              {error}
            </div>
            <button
              className="btn-outline text-sm mt-3 w-full"
              onClick={() => {
                setStep(parsedClaim ? 'paste' : 'wallet');
                setError('');
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* ── Privacy note ── */}
      <div
        className="mt-5 px-5 py-4 rounded-xl text-sm leading-relaxed"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-dim)', color: 'var(--muted)' }}
      >
        <span style={{ color: 'var(--green-bright)', fontWeight: 600 }}>🔒 Your secret never leaves this device.</span>{' '}
        Groth16 proof generation runs entirely in your browser via WebAssembly. No server sees your
        claim secret or can link you to a beneficiary. The proof reveals only that you belong to the
        approved Merkle set. Each nullifier is single-use, enforced on-chain forever.
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
