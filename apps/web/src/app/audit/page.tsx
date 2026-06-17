import type { Metadata } from 'next';
import { ISSUER_PUBLIC_KEY } from '@/lib/credential';
import { CONTRACT_ID, VERIFIER_CONTRACT_ID, DISBURSEMENT_ID, MERKLE_ROOT, EXPLORER_BASE, shortHex } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Trust Audit — ZK AidShield',
  description: 'Full trust model: what is private, what is public, and what guarantees are enforced on-chain vs. off-chain.',
};

interface TrustRow {
  property: string;
  status: 'on-chain' | 'off-chain' | 'private';
  detail: string;
}

const TRUST_TABLE: TrustRow[] = [
  {
    property: 'Claim secret',
    status: 'private',
    detail: 'Never leaves the beneficiary\'s device. Generated offline, shared privately via operator credential. Not stored on any server.',
  },
  {
    property: 'Merkle root',
    status: 'on-chain',
    detail: 'Stored in the disbursement contract and checked against the proof\'s public inputs on every claim.',
  },
  {
    property: 'Nullifier uniqueness',
    status: 'on-chain',
    detail: 'The contract persists every spent nullifier (Poseidon(secret, disbursement_id, claimant_address, 1)) and rejects duplicates.',
  },
  {
    property: 'Proof validity (Groth16)',
    status: 'on-chain',
    detail: 'Verified by the Groth16 verifier contract using native BLS12-381 pairing_check on Soroban. Cannot pass without a valid witness.',
  },
  {
    property: 'Wallet binding (circuit-level)',
    status: 'on-chain',
    detail: 'Phase 3: the Merkle leaf is Poseidon(secret, disbursement_id, claimant_address). The wallet address is committed into the Merkle tree at campaign-generation time. A stolen secret cannot generate a valid proof for a different wallet — the leaf itself encodes who can claim.',
  },
  {
    property: 'Credential issuance',
    status: 'off-chain',
    detail: 'The operator signs credentials with an Ed25519 key. Signature verification happens client-side before proof generation. The operator must vet eligibility off-chain.',
  },
  {
    property: 'Credential expiry',
    status: 'off-chain',
    detail: 'Enforced client-side by the claim frontend. An attacker with a raw secret could bypass expiry — on-chain expiry requires a contract upgrade.',
  },
  {
    property: 'Payout amount',
    status: 'on-chain',
    detail: 'Fixed in the disbursement contract at initialisation. Cannot be changed without a contract upgrade.',
  },
  {
    property: 'Escrow balance',
    status: 'on-chain',
    detail: 'Held in XLM inside the contract. Released directly to the claimant\'s wallet upon a valid proof submission.',
  },
  {
    property: 'Beneficiary identity',
    status: 'private',
    detail: 'Never on-chain. The Merkle tree commits to Poseidon(secret, disbursement_id, wallet) — no names or IDs. The wallet address is a pre-committed field element (248 bits), not a personal identifier. The operator knows the mapping but it is never published.',
  },
];

const ATTACKS: { attack: string; stopped: string; how: string }[] = [
  {
    attack: 'Double claim (replay)',
    stopped: 'On-chain',
    how: 'Nullifier stored permanently after first claim. Contract rejects any reuse.',
  },
  {
    attack: 'Forged proof',
    stopped: 'On-chain',
    how: 'Groth16 soundness — computationally infeasible to produce a valid proof without the witness. Verified via native BLS12-381 pairing.',
  },
  {
    attack: 'Wrong Merkle root',
    stopped: 'On-chain',
    how: 'Public input checked against on-chain root. Proof for a different root fails verification.',
  },
  {
    attack: 'Secret inference from proof',
    stopped: 'Circuit (ZK)',
    how: 'Secret is a private input. Groth16 zero-knowledge property prevents extraction from proof bytes.',
  },
  {
    attack: 'Using another wallet\'s credential',
    stopped: 'On-chain',
    how: 'Phase 3: leaf = Poseidon(secret, disbursement_id, claimant_address). A different wallet generates a different leaf, so no Merkle proof exists for it. Even if one did, the nullifier (Poseidon(secret, disburse_id, wallet, 1)) would mismatch the one written by the true claimant.',
  },
  {
    attack: 'Issuer impersonation',
    stopped: 'Off-chain',
    how: 'ISSUER_PUBLIC_KEY is hardcoded in the claim frontend. Ed25519 signature verified before proof generation begins.',
  },
];

function StatusBadge({ status }: { status: TrustRow['status'] }) {
  const cfg = {
    'on-chain': { bg: '#0e3a1d', color: '#3fb950', label: 'on-chain' },
    'off-chain': { bg: '#1c2b3a', color: '#58a6ff', label: 'off-chain' },
    'private': { bg: '#2d1c3d', color: '#d2a8ff', label: 'private' },
  }[status];
  return (
    <span
      className="mono text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: cfg.bg, color: cfg.color, flexShrink: 0 }}
    >
      {cfg.label}
    </span>
  );
}

function StoppedBadge({ how }: { how: string }) {
  const isOnChain = how === 'On-chain';
  const isCircuit = how === 'Circuit (ZK)';
  return (
    <span
      className="mono text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        background: isOnChain ? '#0e3a1d' : isCircuit ? '#2d1c3d' : '#1c2b3a',
        color: isOnChain ? '#3fb950' : isCircuit ? '#d2a8ff' : '#58a6ff',
      }}
    >
      {how}
    </span>
  );
}

export default function AuditPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-2xl font-bold">Trust Model Audit</h1>
          <span className="badge" style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.7rem' }}>Groth16 · BLS12-381 · Stellar Testnet</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', lineHeight: 1.6 }}>
          Full breakdown of what is private, what is publicly verifiable on-chain, and what is
          enforced off-chain. Judges and auditors should read this page alongside the circuit code.
        </p>
      </div>

      {/* Overview chips */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'On-chain guarantees', n: TRUST_TABLE.filter(r => r.status === 'on-chain').length, color: '#3fb950', bg: '#0e3a1d' },
          { label: 'Off-chain enforced', n: TRUST_TABLE.filter(r => r.status === 'off-chain').length, color: '#58a6ff', bg: '#1c2b3a' },
          { label: 'Private (ZK hidden)', n: TRUST_TABLE.filter(r => r.status === 'private').length, color: '#d2a8ff', bg: '#2d1c3d' },
        ].map((c) => (
          <div key={c.label} className="card text-center py-4">
            <div className="text-3xl font-bold mb-1" style={{ color: c.color }}>{c.n}</div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Trust table */}
      <div className="card mb-8">
        <div className="font-semibold mb-5">Property-by-Property Trust Breakdown</div>
        <div className="space-y-4">
          {TRUST_TABLE.map((row) => (
            <div key={row.property} className="pb-4" style={{ borderBottom: '1px solid var(--border-dim)' }}>
              <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                <span className="font-medium text-sm">{row.property}</span>
                <StatusBadge status={row.status} />
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{row.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Attack resistance */}
      <div className="card mb-8">
        <div className="font-semibold mb-5">Attack Resistance</div>
        <div className="space-y-4">
          {ATTACKS.map((a) => (
            <div key={a.attack} className="pb-4" style={{ borderBottom: '1px solid var(--border-dim)' }}>
              <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                <span className="font-medium text-sm">{a.attack}</span>
                <StoppedBadge how={a.stopped} />
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{a.how}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Known limitations */}
      <div className="card mb-8" style={{ border: '1px solid rgba(227,179,65,0.25)', background: 'rgba(227,179,65,0.03)' }}>
        <div className="font-semibold mb-3 flex items-center gap-2">
          <span style={{ color: 'var(--amber)' }}>⚠</span> Known Limitations (Hackathon Scope)
        </div>
        <ul className="space-y-2 text-sm" style={{ color: 'var(--muted)' }}>
          <li>
            <strong style={{ color: 'var(--text)' }}>Credential expiry:</strong> Enforced client-side only.
            A party with the raw credential JSON could submit after expiry if they bypass the frontend.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Issuer key rotation:</strong> The issuer public key is
            hardcoded in the frontend. Production would need on-chain key registry and revocation.
          </li>
          <li>
            <strong style={{ color: 'var(--text)' }}>Single-slot demo:</strong> The current campaign has one
            Merkle slot. Multiple beneficiaries with the same secret would all produce valid proofs (different nullifiers).
            Full deployment would use one slot per beneficiary.
          </li>
        </ul>
      </div>

      {/* Contract links */}
      <div className="card mb-8">
        <div className="font-semibold mb-4">Deployed Contracts</div>
        <div className="space-y-3 text-sm">
          {[
            { label: 'Disbursement contract', id: CONTRACT_ID },
            { label: 'Groth16 BLS12-381 verifier', id: VERIFIER_CONTRACT_ID },
          ].map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 flex-wrap">
              <span style={{ color: 'var(--muted)' }}>{c.label}</span>
              <a
                href={`${EXPLORER_BASE}/contract/${c.id}`}
                target="_blank" rel="noopener noreferrer"
                className="mono text-xs underline"
                style={{ color: 'var(--green)', wordBreak: 'break-all' }}
              >
                {shortHex(c.id)} ↗
              </a>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span style={{ color: 'var(--muted)' }}>Issuer public key</span>
            <span className="mono text-xs" style={{ color: 'var(--muted-2)', wordBreak: 'break-all' }}>{shortHex(ISSUER_PUBLIC_KEY)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span style={{ color: 'var(--muted)' }}>Disbursement ID</span>
            <span className="mono text-xs" style={{ color: 'var(--muted-2)', wordBreak: 'break-all' }}>{shortHex(DISBURSEMENT_ID)}</span>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span style={{ color: 'var(--muted)' }}>Merkle root (on-chain)</span>
            <span className="mono text-xs" style={{ color: 'var(--muted-2)', wordBreak: 'break-all' }}>{shortHex(MERKLE_ROOT)}</span>
          </div>
        </div>
      </div>

      {/* ZK proof specifics */}
      <div className="card">
        <div className="font-semibold mb-4">ZK Proof Specifics</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            ['Proof system', 'Groth16 (snarkjs)'],
            ['Elliptic curve', 'BLS12-381'],
            ['Circuit language', 'circom 2.1'],
            ['Hash function', 'Poseidon (BLS12-381 scalar field)'],
            ['Private inputs', 'secret, merkle_path (not revealed)'],
            ['Public inputs', 'disbursement_id, merkle_root, nullifier, claimant_address'],
            ['Proof size', '384 bytes (G1 + G2 + G1 uncompressed)'],
            ['On-chain check', 'Native bls.pairing_check on Soroban'],
            ['Proving location', 'Browser WASM (secret never leaves device)'],
            ['Trusted setup', 'Groth16 (requires ceremony for production)'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 py-1" style={{ borderBottom: '1px solid var(--border-dim)' }}>
              <span style={{ color: 'var(--muted)' }}>{k}</span>
              <span className="text-right" style={{ color: 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
