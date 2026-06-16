import Link from 'next/link';

const STEPS = [
  {
    n: '01',
    title: 'Enroll beneficiaries',
    body: 'Aid coordinator generates unique secrets for each approved beneficiary and commits a Pedersen Merkle root to the Soroban smart contract.',
  },
  {
    n: '02',
    title: 'Generate ZK proof',
    body: 'Beneficiary uses their private secret to prove Merkle membership and compute a one-time nullifier — without revealing their identity.',
  },
  {
    n: '03',
    title: 'Claim on Stellar',
    body: 'The Noir proof is verified and the nullifier is stored on-chain. XLM is released from escrow directly to the beneficiary\'s wallet.',
  },
];

const PROPS = [
  { icon: '🔒', label: 'Zero PII on-chain', desc: 'No names, IDs, or biometrics stored on Stellar' },
  { icon: '♻️', label: 'Replay-proof', desc: 'Each nullifier can only be used once, ever' },
  { icon: '🔗', label: 'Address-bound', desc: 'Proof is tied to a specific Stellar wallet' },
  { icon: '⚡', label: 'Instant settlement', desc: 'XLM disbursed in the same transaction as proof' },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <div className="text-center py-16">
        <span className="badge badge-green mb-6">
          <span>●</span> Live on Stellar Testnet
        </span>
        <h1 className="text-4xl font-bold mb-4 leading-tight">
          Privacy-first aid disbursement
          <br />
          <span style={{ color: 'var(--green)' }}>powered by zero-knowledge proofs</span>
        </h1>
        <p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: 'var(--muted)' }}>
          ZK AidShield lets approved beneficiaries claim aid payments on Stellar without revealing
          their identity — using Noir ZK circuits and Soroban smart contracts.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/claim" className="btn-primary text-base">
            Claim Aid →
          </Link>
          <Link href="/admin" className="btn-outline text-base">
            View Dashboard
          </Link>
        </div>
      </div>

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

      {/* Properties */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold mb-6 text-center">Privacy guarantees</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PROPS.map((p) => (
            <div key={p.label} className="card text-center">
              <div className="text-2xl mb-2">{p.icon}</div>
              <div className="font-semibold text-sm mb-1">{p.label}</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {p.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="card">
        <h2 className="text-xl font-semibold mb-4">Technical architecture</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm" style={{ color: 'var(--muted)' }}>
          <div>
            <div className="font-semibold text-white mb-2">ZK Layer (Noir)</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Pedersen Merkle membership proof (depth 8, 256 slots)</li>
              <li>Nullifier derivation: <span className="mono">H(secret, id, 1)</span></li>
              <li>Address binding: <span className="mono">H(secret, wallet)</span></li>
              <li>Barretenberg UltraHonk backend</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-white mb-2">Settlement Layer (Stellar)</div>
            <ul className="space-y-1 list-disc list-inside">
              <li>Soroban smart contract (Protocol 26)</li>
              <li>Persistent nullifier registry</li>
              <li>Admin-controlled Merkle root rotation</li>
              <li>XLM escrow with per-claim payout</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
