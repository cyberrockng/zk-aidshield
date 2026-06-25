import Link from 'next/link';
import {
  CONTRACT_ID,
  DISBURSEMENT_ID,
  EXPLORER_BASE,
  ISSUER_KEY_ID,
  MERKLE_ROOT,
  VERIFIER_CONTRACT_ID,
  VK_HASH,
  shortHex,
} from '@/lib/constants';

const checks = [
  ['Proof system', 'Groth16 BLS12-381', 'Circuit proof is generated off-chain and verified by Soroban.'],
  ['Proof bytes', '384 bytes', 'pi_a, pi_b, and pi_c are packed before verifier submission.'],
  ['Public input: root', shortHex(MERKLE_ROOT), 'Binds proof to the active campaign Merkle root.'],
  ['Public input: campaign', shortHex(DISBURSEMENT_ID), 'Prevents proof reuse across campaigns.'],
  ['Public input: issuer', shortHex(ISSUER_KEY_ID), 'Requires active issuer registry status.'],
  ['Verifier key hash', `${VK_HASH.slice(0, 12)}...${VK_HASH.slice(-8)}`, 'Lets judges compare verifier artifacts with the circuit build.'],
];

const workflow = [
  'Generate or load a beneficiary credential in the claim flow.',
  'Generate the browser Groth16 proof and submit with Freighter.',
  'Copy the generated receipt JSON after settlement.',
  'Open /receipt and check transaction status plus declared AidShield contract against Stellar testnet RPC.',
  'Retry the same credential to show nullifier replay rejection.',
  'Open the disbursement and verifier contracts on Stellar Expert.',
];

export default function VerificationLabPage() {
  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-blue mb-4">Verification Lab</div>
        <h1 className="text-4xl font-bold mb-3">Inspect the proof path without trusting the pitch.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          This page gives judges a compact lab for validating the live proof story: proof system, public inputs,
          verifier key hash, contract anchors, receipt transaction checks, and nullifier replay evidence.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/claim" className="btn-primary text-sm">Run claim</Link>
          <Link href="/receipt" className="btn-outline text-sm">Check receipt tx</Link>
          <Link href="/auditor" className="btn-outline text-sm">Open auditor</Link>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1fr_0.9fr] gap-5">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Proof Statement</h2>
          <div className="space-y-3">
            {checks.map(([label, value, body]) => (
              <div key={label} className="privacy-panel">
                <div className="data-row mb-2">
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span className="mono text-right">{value}</span>
                </div>
                <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Contract Anchors</h2>
            <div className="space-y-3 text-sm">
              {[
                ['Disbursement', CONTRACT_ID, `${EXPLORER_BASE}/contract/${CONTRACT_ID}`],
                ['Verifier', VERIFIER_CONTRACT_ID, `${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}`],
              ].map(([label, value, href]) => (
                <div key={label} className="data-row">
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <a href={href} target="_blank" rel="noopener noreferrer" className="mono underline text-right" style={{ wordBreak: 'break-all' }}>
                    {shortHex(value)}
                  </a>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Lab Sequence</h2>
            <div className="space-y-3">
              {workflow.map((item, index) => (
                <div key={item} className="data-row">
                  <span className="badge badge-blue">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-sm text-right" style={{ color: 'var(--muted-2)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
