import type { Metadata } from 'next';
import Link from 'next/link';
import { CONTRACT_ID, DISBURSEMENT_ID, MERKLE_ROOT, VERIFIER_CONTRACT_ID, VK_HASH, shortHex } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Judge Mode - ZK AidShield',
  description: 'No-wallet judge walkthrough for understanding ZK AidShield before running the live Freighter claim.',
  alternates: { canonical: '/judge-mode' },
};

const STEPS = [
  ['1', 'Read the mission', 'Synthetic flood-relief actors explain who issues, who claims, who redeems, and who audits.'],
  ['2', 'Inspect evidence', 'Contract IDs, verifier, Merkle root, VK hash, and attack matrix are visible without a wallet.'],
  ['3', 'Understand the proof', 'The browser proof hides secret and Merkle witness while publishing root, nullifier, wallet field, expiry, and issuer.'],
  ['4', 'Run live mode', 'Connect Freighter only when ready to generate the real proof and submit the Soroban transaction.'],
];

const SAMPLE = [
  ['Credential type', 'Wallet-bound beneficiary credential'],
  ['Proof size', '384-byte Groth16 proof'],
  ['Public inputs', 'disbursement_id, merkle_root, nullifier, claimant_address, expires_at, issuer_key_id'],
  ['Hidden inputs', 'secret, Merkle path, path indices, aid-list position'],
  ['Replay control', 'Persistent nullifier in disbursement contract'],
];

export default function JudgeModePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div style={{ maxWidth: 820 }}>
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="badge badge-blue">No-wallet path</span>
              <span className="badge badge-green">Live mode available</span>
              <span className="badge badge-amber">Judge friendly</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: 0 }}>
              Judge Mode
            </h1>
            <p className="text-base md:text-lg" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              Review the product without connecting a wallet first. This page explains the proof payload,
              public anchors, and exact live steps before Freighter is required.
            </p>
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: 190 }}>
            <Link href="/claim" className="btn-primary text-sm">Run Live Claim</Link>
            <Link href="/evidence" className="btn-outline text-sm">Evidence</Link>
            <Link href="/mission" className="btn-outline text-sm">Mission</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
        {STEPS.map(([num, title, body]) => (
          <div key={title} className="pipeline-node">
            <div className="mono text-xs mb-2" style={{ color: 'var(--amber)' }}>{num.padStart(2, '0')}</div>
            <div className="font-semibold mb-2">{title}</div>
            <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Sample Proof Payload</h2>
          <div className="space-y-2">
            {SAMPLE.map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="text-right" style={{ maxWidth: 420 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Public Anchors</h2>
          <div className="space-y-2">
            {[
              ['Disbursement', shortHex(CONTRACT_ID)],
              ['Verifier', shortHex(VERIFIER_CONTRACT_ID)],
              ['Disbursement ID', shortHex(DISBURSEMENT_ID)],
              ['Merkle root', shortHex(MERKLE_ROOT)],
              ['VK hash', `${VK_HASH.slice(0, 12)}...${VK_HASH.slice(-8)}`],
            ].map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="mono text-xs text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-3">What Judge Mode Does Not Fake</h2>
        <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
          Judge Mode is explanatory only. It does not replace the live claim. The actual submission proof still
          requires Freighter, browser Groth16 generation, Soroban verification, and a Stellar testnet transaction.
        </p>
      </section>
    </div>
  );
}
