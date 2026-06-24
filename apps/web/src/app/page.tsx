'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchStats } from '@/lib/soroban';
import { EXPLORER_BASE, CONTRACT_ID, stroopsToXlm } from '@/lib/constants';

// ── Live stats strip ────────────────────────────────────────────────────────

function LiveStats() {
  const [stats, setStats] = useState<{ claimed: number; balance: string } | null>(null);
  useEffect(() => {
    fetchStats()
      .then((s) =>
        setStats({
          claimed: s.claimed_count,
          balance: stroopsToXlm(s.escrow_balance),
        }),
      )
      .catch(() => {});
  }, []);

  if (!stats) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-8">
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: 'var(--green-subtle)', border: '1px solid rgba(56,211,100,0.2)', color: 'var(--green-bright)' }}
      >
        <span className="live-dot" />
        <span>{stats.balance} XLM in escrow</span>
      </div>
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: '#0c1726', border: '1px solid rgba(88,166,255,0.2)', color: 'var(--blue)' }}
      >
        {stats.claimed} claims paid on-chain
      </div>
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: '#1c1507', border: '1px solid rgba(227,179,65,0.2)', color: 'var(--amber)' }}
      >
        384-byte Groth16 proof
      </div>
    </div>
  );
}

// ── ZK flow diagram ─────────────────────────────────────────────────────────

function FlowNode({
  icon,
  title,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center text-center"
      style={{ minWidth: 110, maxWidth: 130 }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          background: highlight ? 'rgba(63,185,80,0.12)' : 'var(--surface-2)',
          border: `1px solid ${highlight ? 'rgba(63,185,80,0.3)' : 'var(--border)'}`,
          marginBottom: 10,
        }}
      >
        {icon}
      </div>
      <div className="font-semibold text-sm mb-0.5" style={{ color: highlight ? 'var(--green-bright)' : 'var(--text)' }}>
        {title}
      </div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        {sub}
      </div>
    </div>
  );
}

function FlowArrow({ label, delay = 0 }: { label: string; delay?: number }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-2" style={{ minWidth: 60 }}>
      <div
        className="flow-line w-full"
        style={{ marginBottom: 6 }}
      >
        <div className="flow-line-dot" style={{ animationDelay: `${delay}s` }} />
        <div className="flow-line-dot" style={{ animationDelay: `${delay + 0.7}s` }} />
      </div>
      <div className="text-xs text-center" style={{ color: 'var(--muted)', lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  );
}

function ZkFlowDiagram() {
  return (
    <div
      className="card-glow p-6"
      style={{ animation: 'fade-in-up 0.6s ease both', animationDelay: '0.2s' }}
    >
      <div className="text-xs font-semibold mb-4 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
        How the proof flows
      </div>
      <div className="flex items-center">
        <FlowNode
          icon={<span>🔑</span>}
          title="Beneficiary"
          sub="Private secret"
        />
        <FlowArrow label="Merkle witness" delay={0} />
        <FlowNode
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="var(--green)" strokeWidth="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="var(--green)" strokeWidth="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="var(--green)" strokeWidth="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="var(--green)" strokeWidth="1.5"/>
              <line x1="10" y1="6.5" x2="14" y2="6.5" stroke="var(--green)" strokeWidth="1"/>
              <line x1="6.5" y1="10" x2="6.5" y2="14" stroke="var(--green)" strokeWidth="1"/>
              <line x1="17.5" y1="10" x2="17.5" y2="14" stroke="var(--green)" strokeWidth="1"/>
              <line x1="10" y1="17.5" x2="14" y2="17.5" stroke="var(--green)" strokeWidth="1"/>
            </svg>
          }
          title="ZK Circuit"
          sub="Groth16 BLS12-381"
          highlight
        />
        <FlowArrow label="384-byte proof" delay={0.4} />
        <FlowNode
          icon={<span>⛓️</span>}
          title="Soroban"
          sub="Pairing check"
        />
        <FlowArrow label="XLM released" delay={0.8} />
        <FlowNode
          icon={<span>💸</span>}
          title="Beneficiary"
          sub="Receives payment"
        />
      </div>
      <div
        className="mt-5 pt-4 text-xs"
        style={{ borderTop: '1px solid var(--border-dim)', color: 'var(--muted)', lineHeight: 1.7 }}
      >
        <span style={{ color: 'var(--green-bright)', fontWeight: 600 }}>Secret stays in the browser.</span>
        {' '}The ZK proof leaves. The contract verifies a BLS12-381 pairing equation — never sees the secret.
        {' '}Nullifier is written on-chain to prevent replay.
      </div>
    </div>
  );
}

// ── How it works steps ───────────────────────────────────────────────────────

const STEPS = [
  {
    n: '01',
    title: 'Coordinator commits',
    icon: '📋',
    body: 'Aid coordinator generates unique secrets for each approved beneficiary and commits a Poseidon Merkle root to the Soroban contract. No names, IDs, or personal data ever touch the chain.',
  },
  {
    n: '02',
    title: 'Beneficiary proves',
    icon: '⚡',
    body: 'Beneficiary loads their private claim file. A Groth16 BLS12-381 circuit runs in their browser via WASM — proving Merkle membership and computing a wallet-bound nullifier. Secret never leaves the device.',
  },
  {
    n: '03',
    title: 'Stellar settles',
    icon: '🌐',
    body: 'The 384-byte Groth16 proof is verified on-chain with a native BLS12-381 pairing check. Nullifier is recorded permanently. XLM releases from escrow in the same transaction.',
  },
];

// ── Privacy guarantees ───────────────────────────────────────────────────────

const GUARANTEES = [
  {
    icon: '🔒',
    label: 'Zero PII on-chain',
    desc: 'No names, IDs, or biometrics ever reach Stellar',
  },
  {
    icon: '♻️',
    label: 'Replay-proof',
    desc: 'Nullifier written on-chain; double-claim is cryptographically impossible',
  },
  {
    icon: '🔗',
    label: 'Address-bound',
    desc: 'Proof encodes your wallet — stolen proofs are useless to others',
  },
  {
    icon: '🌐',
    label: 'Client-side WASM',
    desc: 'Proof generation runs locally; no server ever sees your secret',
  },
];

// ── Tech stack ───────────────────────────────────────────────────────────────

const TECH = [
  {
    heading: 'ZK Layer',
    sub: 'circom + snarkjs · BLS12-381',
    items: [
      'Poseidon Merkle membership proof — depth 8, 256 slots',
      'Nullifier: Poseidon(secret, disburse_id, wallet, 1)',
      'Groth16 proof — 384 bytes, generated in browser via WASM',
      'Proving key: Groth16 VK initialized on Soroban',
    ],
  },
  {
    heading: 'Settlement Layer',
    sub: 'Stellar Soroban · Protocol 22',
    items: [
      'Native BLS12-381 pairing_check — no off-chain verifier',
      'Persistent nullifier registry — replay attacks impossible',
      'Admin-controlled Merkle root — add beneficiaries without redeploy',
      'XLM SAC escrow — atomic proof + payout in one transaction',
    ],
  },
];

const WIN_SIGNALS = [
  {
    label: 'ZK does real work',
    body: 'The proof gates settlement. Without a valid Groth16 proof, the disbursement contract cannot release funds.',
  },
  {
    label: 'Stellar is the settlement layer',
    body: 'Soroban verifies the proof path and releases XLM from escrow through the Stellar Asset Contract.',
  },
  {
    label: 'Privacy is bounded honestly',
    body: 'Aid-list membership, credential secrets, and witnesses stay private; payout wallet, timing, amount, and nullifier stay public for accountability.',
  },
  {
    label: 'Threat paths are demoable',
    body: 'Replay, wrong wallet, revoked issuer, unauthorized vendor, underfunded escrow, and emergency pause are visible failure paths.',
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div>

      {/* ── Hero ── */}
      <section className="pt-6 pb-16">
        <div className="flex flex-wrap gap-3 mb-8">
          <span className="badge badge-green">
            <span className="live-dot" />
            Live on Stellar Testnet
          </span>
          <span className="badge badge-blue">Stellar Hacks: Real-World ZK</span>
          <span className="badge badge-amber">Groth16 BLS12-381</span>
        </div>

        <h1
          className="text-5xl font-extrabold leading-tight mb-5"
          style={{ letterSpacing: '0', animation: 'fade-in-up 0.5s ease both' }}
        >
          Private aid eligibility.
          <br />
          <span className="gradient-text">Public settlement accountability.</span>
        </h1>

        <p
          className="text-lg max-w-2xl mb-8 leading-relaxed"
          style={{ color: 'var(--muted-2)', animation: 'fade-in-up 0.5s ease 0.1s both' }}
        >
          ZK AidShield lets crisis-aid beneficiaries prove they are approved, claim once, and receive
          Stellar testnet aid without exposing their aid-list membership. Donors still get public escrow,
          settlement, nullifier, and aggregate audit evidence.
        </p>

        <div
          className="flex gap-3 flex-wrap"
          style={{ animation: 'fade-in-up 0.5s ease 0.15s both' }}
        >
            <Link href="/claim" className="btn-primary text-base" style={{ padding: '0.75rem 2rem' }}>
              Try the Demo →
            </Link>
            <Link href="/mission" className="btn-outline text-base" style={{ padding: '0.75rem 2rem' }}>
              Crisis Mission
            </Link>
            <Link href="/evidence" className="btn-outline text-base" style={{ padding: '0.75rem 2rem' }}>
              Evidence Dossier
            </Link>
            <Link href="/protocol" className="btn-outline text-base" style={{ padding: '0.75rem 2rem' }}>
              Stellar ZK Fit
            </Link>
            <a
              href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
              target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-base"
            style={{ padding: '0.75rem 2rem' }}
          >
            View Contract ↗
          </a>
        </div>

        <LiveStats />
      </section>

      {/* ── ZK flow diagram ── */}
      <section className="mb-16">
        <ZkFlowDiagram />
      </section>

      <section className="mb-16">
        <div className="section-panel">
          <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
            <div style={{ maxWidth: 720 }}>
              <h2 className="text-2xl font-bold mb-2">Why this is stronger than a normal ZK demo</h2>
              <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                The submission is packaged as a crisis-aid mission, but the winning claim is technical:
                private eligibility proof is directly connected to Stellar settlement and public donor accountability.
              </p>
            </div>
            <Link href="/evidence" className="btn-outline text-sm">Verify Evidence</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {WIN_SIGNALS.map((signal) => (
              <div key={signal.label} className="route-card">
                <div className="font-semibold mb-2">{signal.label}</div>
                <p className="text-sm" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{signal.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem / Solution ── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2 text-center">Why traditional aid systems fail</h2>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Privacy breaches in humanitarian databases endanger the very people they serve.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card" style={{ borderColor: 'rgba(248,81,73,0.2)', background: '#110d0d' }}>
            <div className="font-semibold mb-4 text-sm flex items-center gap-2" style={{ color: '#f85149' }}>
              <span>✗</span> Traditional aid distribution
            </div>
            <ul className="space-y-3">
              {[
                'Beneficiary names and IDs stored in databases that get leaked or seized',
                'Aid workers can see who received what — enabling targeting in conflict zones',
                'Duplicate claims go undetected across siloed systems',
                'Proof of receipt requires revealing identity to a third party',
              ].map((p) => (
                <li key={p} className="flex gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                  <span style={{ color: '#f85149', flexShrink: 0 }}>✗</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="card" style={{ borderColor: 'rgba(63,185,80,0.2)', background: 'var(--green-subtle)' }}>
            <div className="font-semibold mb-4 text-sm flex items-center gap-2" style={{ color: 'var(--green-bright)' }}>
              <span>✓</span> ZK AidShield
            </div>
            <ul className="space-y-3">
              {[
                'Zero PII on-chain — no names, IDs, or biometrics ever stored',
                'Cryptographic proof of eligibility with no identity disclosure',
                'One-time nullifier prevents any duplicate claim, on-chain forever',
                'Wallet-bound proof: only the intended recipient can claim',
              ].map((s) => (
                <li key={s} className="flex gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                  <span style={{ color: 'var(--green-bright)', flexShrink: 0 }}>✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2 text-center">How it works</h2>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Three steps. No identity revealed at any stage.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((s) => (
            <div key={s.n} className="card-glow">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{s.icon}</span>
                <span
                  className="text-3xl font-black mono"
                  style={{ color: 'var(--border)', lineHeight: 1 }}
                >
                  {s.n}
                </span>
              </div>
              <h3 className="font-bold mb-2">{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Privacy guarantees ── */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-2 text-center">Privacy guarantees</h2>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--muted)' }}>
          Each guarantee is enforced cryptographically — not by policy or trust.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {GUARANTEES.map((g) => (
            <div key={g.label} className="card-glow text-center">
              <div className="text-3xl mb-3">{g.icon}</div>
              <div className="font-bold text-sm mb-1">{g.label}</div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
                {g.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Technical architecture ── */}
      <section className="card-glow mb-16">
        <h2 className="text-xl font-bold mb-1">Technical architecture</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          End-to-end Groth16 BLS12-381 — the same elliptic curve used by Ethereum 2.0.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          {TECH.map((col) => (
            <div key={col.heading}>
              <div className="font-bold mb-0.5">{col.heading}</div>
              <div className="text-xs mb-3 mono" style={{ color: 'var(--green)' }}>{col.sub}</div>
              <ul className="space-y-2">
                {col.items.map((item) => (
                  <li key={item} className="flex gap-2" style={{ color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--green-dim)', flexShrink: 0 }}>›</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Demo CTA ── */}
      <section
        className="rounded-2xl text-center py-14 px-6 mb-4"
        style={{
          background: 'linear-gradient(135deg, #0d1f12 0%, #0c1726 100%)',
          border: '1px solid rgba(63,185,80,0.2)',
        }}
      >
        <div className="flex justify-center mb-4">
          <span className="badge badge-green">
            <span className="live-dot" />
            Ready to demo — Freighter required
          </span>
        </div>
        <h2 className="text-3xl font-extrabold mb-3" style={{ letterSpacing: '-0.02em' }}>
          See a Groth16 proof land on Stellar
        </h2>
        <p className="text-sm max-w-lg mx-auto mb-8" style={{ color: 'var(--muted)' }}>
          Connect a Freighter wallet on testnet, load the demo claim, and watch a BLS12-381 proof
          generate in your browser in ~15 seconds. Then try claiming twice — the second attempt will
          be blocked on-chain by the nullifier.
        </p>
        <Link href="/claim" className="btn-primary text-base" style={{ padding: '0.875rem 2.5rem', fontSize: '1rem' }}>
          Open Claim Demo →
        </Link>
        <div className="flex justify-center gap-3 flex-wrap mt-4">
          <Link href="/judge-mode" className="btn-outline text-sm">Judge Mode</Link>
          <Link href="/pilot" className="btn-outline text-sm">Field Pilot Plan</Link>
        </div>
      </section>

    </div>
  );
}
