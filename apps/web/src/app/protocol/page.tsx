import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CONTRACT_ID,
  DISBURSEMENT_ID,
  EXPLORER_BASE,
  MERKLE_ROOT,
  VERIFIER_CONTRACT_ID,
  VK_HASH,
  shortHex,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Real-World ZK on Stellar - ZK AidShield',
  description:
    'Protocol-aware map showing how ZK AidShield uses Circom/Groth16, Soroban proof verification, and Stellar settlement.',
  alternates: { canonical: '/protocol' },
};

const ALIGNMENT = [
  ['Off-chain proof generation', 'Circom + snarkjs generate a Groth16 proof in the beneficiary browser.'],
  ['On-chain proof verification', 'Soroban verifier contract checks the BLS12-381 Groth16 proof before payout.'],
  ['Real-world Stellar use case', 'Aid moves from XLM escrow to a beneficiary wallet or approved vendor.'],
  ['ZK is load-bearing', 'No valid proof means no settlement, no voucher redemption, and no successful claim.'],
  ['Public accountability', 'Escrow, nullifier, contract IDs, claim count, and settlement transaction stay auditable.'],
  ['Private eligibility', 'Names, IDs, Merkle path, credential secret, and aid-list membership stay off-chain.'],
];

const STACK = [
  ['Circuit', 'Circom 2.1 membership + nullifier statement'],
  ['Proof system', 'Groth16 on BLS12-381'],
  ['Hashing', 'Poseidon over the BLS12-381 scalar field'],
  ['Verifier', 'Soroban smart contract using BLS12-381 pairing verification'],
  ['Settlement', 'XLM Stellar Asset Contract escrow'],
  ['Wallet', 'Freighter on Stellar testnet'],
];

const ANCHORS = [
  ['Disbursement contract', shortHex(CONTRACT_ID), `${EXPLORER_BASE}/contract/${CONTRACT_ID}`],
  ['Groth16 verifier', shortHex(VERIFIER_CONTRACT_ID), `${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}`],
  ['Disbursement ID', shortHex(DISBURSEMENT_ID), ''],
  ['Merkle root', shortHex(MERKLE_ROOT), ''],
  ['VK hash', `${VK_HASH.slice(0, 12)}...${VK_HASH.slice(-8)}`, ''],
];

export default function ProtocolPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <section className="section-panel mb-8">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div style={{ maxWidth: 820 }}>
            <div className="flex flex-wrap gap-3 mb-5">
              <span className="badge badge-green">Real-World ZK</span>
              <span className="badge badge-blue">Circom + Groth16</span>
              <span className="badge badge-amber">Soroban verification</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: 0 }}>
              Why This Fits Stellar Hacks
            </h1>
            <p className="text-base md:text-lg" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              AidShield closes the exact gap the hackathon describes: proofs are generated off-chain,
              verified by a Stellar smart contract, and used to control a real settlement workflow.
            </p>
          </div>
          <div className="flex flex-col gap-2" style={{ minWidth: 190 }}>
            <Link href="/evidence" className="btn-primary text-sm">Evidence Dossier</Link>
            <Link href="/mission" className="btn-outline text-sm">Mission Demo</Link>
            <Link href="/claim" className="btn-outline text-sm">Live Claim</Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="metric-card">
          <div className="metric-label">ZK option</div>
          <div className="metric-value">Circom</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Verifier location</div>
          <div className="metric-value">Soroban</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Settlement</div>
          <div className="metric-value">XLM escrow</div>
        </div>
      </section>

      <section className="card mb-8">
        <h2 className="font-bold text-lg mb-4">Hackathon Alignment Map</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ALIGNMENT.map(([title, body]) => (
            <div key={title} className="disclosure-row">
              <div className="font-semibold mb-1">{title}</div>
              <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Protocol Stack</h2>
          <div className="space-y-2">
            {STACK.map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold text-lg mb-4">Verification Anchors</h2>
          <div className="space-y-2">
            {ANCHORS.map(([label, value, href]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="mono text-xs underline text-right" style={{ color: 'var(--green)', wordBreak: 'break-all' }}>
                    {value} ↗
                  </a>
                ) : (
                  <span className="mono text-xs text-right" style={{ wordBreak: 'break-all' }}>{value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-panel mb-8">
        <h2 className="font-bold text-lg mb-3">The Standout Claim</h2>
        <p className="text-sm md:text-base" style={{ color: 'var(--muted)', lineHeight: 1.75 }}>
          ZK AidShield turns Stellar into a privacy-preserving crisis-aid settlement rail:
          beneficiaries prove eligibility privately, Soroban verifies the proof, XLM settles from escrow,
          and donors audit outcomes without seeing the beneficiary list.
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/judge-mode" className="btn-primary">Open Judge Mode</Link>
        <Link href="/pilot" className="btn-outline">Field Pilot Plan</Link>
        <Link href="/threats" className="btn-outline">Attack Theater</Link>
      </section>
    </div>
  );
}
