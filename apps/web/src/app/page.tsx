'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchStats } from '@/lib/soroban';
import { EXPLORER_BASE, CONTRACT_ID, stroopsToXlm } from '@/lib/constants';

const PROBLEMS = [
  'Beneficiary names and IDs stored in databases that get leaked',
  'Aid workers can see who received what — enabling targeting',
  'Duplicate claims go undetected across siloed systems',
  'Proof of receipt requires revealing identity to a third party',
];

const SOLUTIONS = [
  'Zero PII on-chain — no names, IDs, or biometrics ever stored',
  'Cryptographic proof of eligibility with no identity disclosure',
  'One-time nullifier prevents any duplicate claim, on-chain forever',
  'Wallet-bound proof: only the intended recipient can claim',
];

const STEPS = [
  {
    n: '01',
    title: 'Coordinator commits',
    body: 'Aid coordinator generates unique secrets for each approved beneficiary and commits a Pedersen Merkle root to the Soroban smart contract. No beneficiary data touches the chain.',
  },
  {
    n: '02',
    title: 'Beneficiary proves',
    body: 'Beneficiary loads their private claim entry. A Noir ZK circuit runs entirely in their browser — proving Merkle membership and deriving a one-time nullifier. Secret never leaves the device.',
  },
  {
    n: '03',
    title: 'Stellar settles',
    body: 'The UltraHonk proof is verified on-chain. Nullifier is recorded permanently. XLM releases from escrow to the beneficiary\'s wallet in the same transaction.',
  },
];

const GUARANTEES = [
  { icon: '🔒', label: 'Zero PII', desc: 'No names, IDs, or biometrics stored on Stellar — ever' },
  { icon: '♻️', label: 'Replay-proof', desc: 'Nullifier written on-chain; double-claim is impossible' },
  { icon: '🔗', label: 'Address-bound', desc: 'Proof is tied to one wallet — stolen proofs are useless' },
  { icon: '🌐', label: 'Client-side WASM', desc: 'Proof generation runs in browser; server never sees secrets' },
];

function LiveStats() {
  const [stats, setStats] = useState<{ claimed: number; balance: string } | null>(null);

  useEffect(() => {
    fetchStats()
      .then((s) => setStats({
        claimed: s.claimed_count,
        balance: stroopsToXlm(s.escrow_balance),
      }))
      .catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm"
      style={{ color: 'var(--muted)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--green)', fontWeight: 700 }}>{stats.claimed}</span>
        <span>claims paid on testnet</span>
      </div>
      <span style={{ color: 'var(--border)' }}>·</span>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--green)', fontWeight: 700 }}>{stats.balance} XLM</span>
        <span>in escrow</span>
      </div>
      <span style={{ color: 'var(--border)' }}>·</span>
      <a
        href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-white transition-colors"
      >
        Verify on Stellar Expert ↗
      </a>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16 pb-12">
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          <span className="badge badge-green">
            <span>●</span> Live on Stellar Testnet
          </span>
          <span className="badge badge-blue">
            Stellar Hacks: Real-World ZK
          </span>
        </div>
        <h1 className="text-4xl font-bold mb-4 leading-tight">
          Aid that proves eligibility
          <br />
          <span style={{ color: 'var(--green)' }}>without exposing identity</span>
        </h1>
        <p className="text-lg max-w-xl mx-auto mb-8" style={{ color: 'var(--muted)' }}>
          ZK AidShield disburses humanitarian aid on Stellar using zero-knowledge proofs —
          beneficiaries prove they belong to the approved set without revealing who they are.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/claim" className="btn-primary text-base">
            Try the Demo →
          </Link>
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-base"
          >
            View Contract ↗
          </a>
        </div>
        <LiveStats />
      </div>

      {/* Problem / Solution */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold mb-6 text-center">The problem with today's aid systems</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card" style={{ borderColor: '#7f1d1d' }}>
            <div className="font-semibold mb-4 text-sm" style={{ color: '#f87171' }}>
              Traditional aid distribution
            </div>
            <ul className="space-y-3">
              {PROBLEMS.map((p) => (
                <li key={p} className="flex gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                  <span style={{ color: '#f87171', flexShrink: 0 }}>✗</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="card" style={{ borderColor: 'var(--green-dim)' }}>
            <div className="font-semibold mb-4 text-sm" style={{ color: 'var(--green)' }}>
              ZK AidShield
            </div>
            <ul className="space-y-3">
              {SOLUTIONS.map((s) => (
                <li key={s} className="flex gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold mb-6 text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card">
              <div
                className="text-3xl font-bold mb-3 mono"
                style={{ color: 'var(--green)' }}
              >
                {s.n}
              </div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy guarantees */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold mb-6 text-center">Privacy guarantees</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GUARANTEES.map((g) => (
            <div key={g.label} className="card text-center">
              <div className="text-2xl mb-2">{g.icon}</div>
              <div className="font-semibold text-sm mb-1">{g.label}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{g.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="card mb-16">
        <h2 className="text-xl font-semibold mb-4">Technical architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm" style={{ color: 'var(--muted)' }}>
          <div>
            <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>ZK Layer (Noir + Barretenberg)</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Pedersen Merkle membership proof — depth 8, 256 slots</li>
              <li>Nullifier: <span className="mono">H(secret, disburse_id, wallet, 1)</span></li>
              <li>Address binding enforced in Soroban contract on-chain</li>
              <li>UltraHonk backend — proof generated in browser via WASM</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Settlement Layer (Stellar Soroban)</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Protocol 26 Soroban contract — structural proof verification</li>
              <li>Persistent nullifier registry — replay attacks impossible</li>
              <li>Admin-controlled Merkle root rotation — add beneficiaries without redeploy</li>
              <li>XLM SAC escrow — atomic proof + payout in one transaction</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Demo CTA */}
      <section
        className="card text-center py-12"
        style={{ borderColor: 'var(--green-dim)', background: '#05130a' }}
      >
        <h2 className="text-2xl font-bold mb-3">See it live on Stellar testnet</h2>
        <p className="text-sm mb-6 max-w-lg mx-auto" style={{ color: 'var(--muted)' }}>
          Connect a Freighter wallet, load the demo claim, and watch a ZK proof generate entirely
          in your browser. Then try claiming twice — the second attempt will be blocked on-chain.
        </p>
        <Link href="/claim" className="btn-primary text-base">
          Open Claim Demo →
        </Link>
      </section>
    </div>
  );
}
