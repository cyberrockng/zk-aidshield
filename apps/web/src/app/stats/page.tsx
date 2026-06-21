'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchStats, type CampaignStats } from '@/lib/soroban';
import {
  CONTRACT_ID, VERIFIER_CONTRACT_ID, EXPLORER_BASE,
  DISBURSEMENT_ID, MERKLE_ROOT, VK_HASH, stroopsToXlm, shortHex, RPC_URL,
} from '@/lib/constants';

interface ClaimEvent {
  txHash: string;
  ledger: number;
  topicCount: number;
}

async function fetchRecentClaims(): Promise<ClaimEvent[]> {
  // Query the last ~2000 ledgers (~2-3 hours) for claim.paid events
  const latestRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger' }),
  });
  const { result: { sequence } } = await latestRes.json() as { result: { sequence: number } };
  const startLedger = Math.max(1, sequence - 2000);

  const evtRes = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'getEvents',
      params: {
        startLedger,
        filters: [{
          type: 'contract',
          contractIds: [CONTRACT_ID],
        }],
        pagination: { limit: 20 },
      },
    }),
  });
  const evtJson = await evtRes.json() as { result?: { events: Array<{ txHash: string; ledger: number; topic: string[]; value: string }> } };
  const events = evtJson.result?.events ?? [];

  return events
    .filter((e) => e.topic?.length >= 2)
    .map((e) => ({
      txHash: e.txHash,
      ledger: e.ledger,
      topicCount: e.topic.length,
    }));
}

const ZK_FACTS = [
  { label: 'Proof system', value: 'Groth16 (snarkjs)' },
  { label: 'Elliptic curve', value: 'BLS12-381' },
  { label: 'Circuit language', value: 'circom 2.1' },
  { label: 'Hash function', value: 'Poseidon (BLS12-381 scalar field)' },
  { label: 'Leaf formula', value: 'Poseidon(secret, disburse_id, wallet, expires_at, issuer_key_id)' },
  { label: 'Nullifier formula', value: 'Poseidon(secret, disburse_id, wallet, 1)' },
  { label: 'Merkle tree depth', value: '8 levels · 256 slots' },
  { label: 'Proof size', value: '384 bytes (G1 + G2 + G1 uncompressed)' },
  { label: 'Public inputs', value: '6 (disburse_id, merkle_root, nullifier, wallet, expires_at, issuer)' },
  { label: 'On-chain verification', value: 'Native BLS12-381 pairing_check on Soroban' },
  { label: 'Proving location', value: 'Browser WASM (secret never leaves device)' },
  { label: 'Proving time', value: '~15–30 s (single-thread WASM)' },
];

const CONTRACTS = [
  { label: 'Disbursement contract', id: CONTRACT_ID, path: 'contract' },
  { label: 'Verifier contract', id: VERIFIER_CONTRACT_ID, path: 'contract' },
];

const PUBLIC_AUDIT_FIELDS = [
  ['Escrow balance', 'Public', 'Read from the XLM SAC balance held by the disbursement contract.'],
  ['Claims paid', 'Public', 'Stored by the disbursement contract as aggregate claim count.'],
  ['Nullifiers', 'Public', 'Prevent replay without exposing the credential secret or Merkle path.'],
  ['Vendor redemptions', 'Public settlement', 'Approved-vendor voucher claims emit settlement events and pay the vendor wallet.'],
  ['Beneficiary list', 'Private', 'Only the Merkle root is public; the eligible wallet set stays off-chain.'],
  ['Credential witness', 'Private', 'Secret, leaf index, and Merkle path stay in the beneficiary credential/browser.'],
];

const CONTROL_CHECKS = [
  ['Proof verification', 'Soroban calls the Groth16 verifier contract before any transfer.'],
  ['Wallet binding', 'The public claimant field must match the connected wallet address.'],
  ['Replay protection', 'A consumed nullifier blocks cash and voucher reuse.'],
  ['Expiry enforcement', 'Expired credentials fail against ledger timestamp.'],
  ['Issuer controls', 'Only active issuer key IDs are accepted by the contract.'],
  ['Vendor controls', 'Voucher claims can pay only active vendor addresses approved by admin.'],
  ['Emergency pause', 'Admin can pause payout execution without changing the public audit state.'],
  ['Escrow accounting', 'Remaining capacity is derived from live contract balance and payout size.'],
];

export default function StatsPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<ClaimEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, evts] = await Promise.all([fetchStats(), fetchRecentClaims()]);
      setStats(s);
      setEvents(evts);
      setLastUpdated(new Date());
    } catch {
      // silently retry on next tick
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const totalCapacity = stats
    ? Number(stats.escrow_balance) + stats.claimed_count * Number(stats.payout_amount)
    : 0;
  const usedPct = totalCapacity > 0
    ? (stats!.claimed_count * Number(stats!.payout_amount) / totalCapacity) * 100
    : 0;
  const remainingClaims = stats
    ? Math.floor(Number(stats.escrow_balance) / Number(stats.payout_amount))
    : 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="section-panel mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="badge badge-blue mb-3">Public auditor dashboard</div>
          <h1 className="text-3xl font-bold mb-2">Campaign Audit Dashboard</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Live escrow health, proof anchors, privacy boundaries, and settlement events for public review.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {lastUpdated && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm"
            style={{ padding: '5px 12px' }}
          >
            Explorer
          </a>
        </div>
      </div>

      {/* Big numbers */}
      {loading ? (
        <div className="card text-center py-16 mb-6" style={{ color: 'var(--muted)' }}>
          Loading on-chain data…
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Claims paid', value: String(stats.claimed_count), green: true },
              { label: 'Escrow remaining', value: `${stroopsToXlm(stats.escrow_balance)} XLM`, green: true },
              { label: 'Per claim', value: `${stroopsToXlm(stats.payout_amount)} XLM`, green: false },
              { label: 'Can still claim', value: String(remainingClaims), green: remainingClaims > 0 },
            ].map((s) => (
              <div key={s.label} className="metric-card">
                <div className="metric-label">{s.label}</div>
                <div className="metric-value" style={{ color: s.green ? 'var(--green-bright)' : 'var(--text)' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Escrow utilization bar */}
          <div className="card mb-6">
            <div className="flex justify-between text-sm mb-3">
              <span className="font-semibold">Escrow utilization</span>
              <span style={{ color: 'var(--muted)' }}>{usedPct.toFixed(1)}% paid out</span>
            </div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: 'var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(usedPct, 100)}%`,
                  background: 'var(--green)',
                  borderRadius: 999,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>
            <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--muted)' }}>
              <span>{stroopsToXlm(BigInt(stats.claimed_count) * stats.payout_amount)} XLM paid</span>
              <span>{stroopsToXlm(stats.escrow_balance)} XLM remaining</span>
            </div>
          </div>

          {/* Campaign details */}
          <div className="card mb-6">
            <div className="font-semibold mb-4">Campaign Details</div>
            <div className="text-sm">
              {[
                { label: 'Disbursement ID', value: DISBURSEMENT_ID },
                { label: 'Merkle root', value: MERKLE_ROOT },
                { label: 'Verifier key hash', value: VK_HASH },
                { label: 'Network', value: 'Stellar Testnet · Protocol 22' },
              ].map((r) => (
                <div key={r.label} className="data-row">
                  <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{r.label}</span>
                  <span className="mono text-xs text-right" style={{ wordBreak: 'break-all' }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-8 mb-6" style={{ color: '#f87171' }}>
          Could not fetch on-chain data — RPC may be unavailable.
        </div>
      )}

      {/* Contracts */}
      <div className="card mb-6">
        <div className="font-semibold mb-4">Deployed Contracts</div>
        <div>
          {CONTRACTS.map((c) => (
            <div key={c.id} className="data-row text-sm">
              <span style={{ color: 'var(--muted)' }}>{c.label}</span>
              <a
                href={`${EXPLORER_BASE}/${c.path}/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono text-xs underline"
                style={{ color: 'var(--green)', wordBreak: 'break-all' }}
              >
                {shortHex(c.id)}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Audit interpretation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="font-semibold mb-4">What Auditors Can Verify</div>
          <div className="space-y-3">
            {PUBLIC_AUDIT_FIELDS.map(([field, visibility, detail]) => (
              <div key={field} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm font-semibold">{field}</span>
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.65rem',
                      background: visibility === 'Private' ? '#1c1507' : '#0d1f12',
                      color: visibility === 'Private' ? 'var(--amber)' : 'var(--green-bright)',
                      border: `1px solid ${visibility === 'Private' ? 'rgba(227,179,65,0.25)' : 'rgba(86,211,100,0.22)'}`,
                    }}
                  >
                    {visibility}
                  </span>
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                  {detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-4">Controls Covered In Demo</div>
          <div className="grid grid-cols-1 gap-2">
            {CONTROL_CHECKS.map(([label, detail]) => (
              <div key={label} className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-dim)' }}>
                <div className="text-sm font-semibold mb-1" style={{ color: 'var(--green-bright)' }}>{label}</div>
                <div className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>{detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Verifier status */}
      <div className="card mb-6">
        <div className="font-semibold mb-4 flex items-center gap-2">
          Verifier Status
          <span className="mono text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#0e3a1d', color: '#3fb950' }}>
            on-chain · full pairing
          </span>
        </div>
        <div className="text-sm">
          {[
            { label: 'On-chain check', value: 'Native BLS12-381 bls.pairing_check' },
            { label: 'Verifier contract', value: shortHex(VERIFIER_CONTRACT_ID), link: `${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}` },
            { label: 'VK hash (SHA-256)', value: `${VK_HASH.slice(0, 12)}…${VK_HASH.slice(-8)}`, mono: true, full: VK_HASH },
            { label: 'Constraints', value: '2576 non-linear (circom 2.1)' },
          ].map((r) => (
            <div key={r.label} className="data-row">
              <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{r.label}</span>
              {r.link ? (
                <a href={r.link} target="_blank" rel="noopener noreferrer" className="mono text-xs underline text-right" style={{ color: 'var(--green)', wordBreak: 'break-all' }}>
                  {r.value}
                </a>
              ) : (
                <span className={r.mono ? 'mono text-xs text-right' : 'text-right'} style={{ wordBreak: 'break-all' }} title={r.full}>
                  {r.value}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ZK proof facts */}
      <div className="card mb-6">
        <div className="font-semibold mb-4">ZK Proof Details</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {ZK_FACTS.map((f) => (
            <div key={f.label} className="flex justify-between gap-2 py-1" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>{f.label}</span>
              <span className="text-right" style={{ color: 'var(--text)' }}>{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent events */}
      <div className="card">
        <div className="font-semibold mb-4">
          Recent Settlement Events
          <span className="text-xs font-normal ml-2" style={{ color: 'var(--muted)' }}>last ~2 hours</span>
        </div>
        {events.length === 0 ? (
          <div className="text-sm py-4 text-center" style={{ color: 'var(--muted)' }}>
            No recent claim or voucher events in this window.
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div
                key={e.txHash}
                className="flex items-center justify-between gap-4 text-xs mono py-2"
                style={{ borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}
              >
                <span style={{ color: 'var(--green)' }}>settlement event</span>
                <span>ledger {e.ledger.toLocaleString()}</span>
                <span>{e.topicCount} topics</span>
                <a
                  href={`${EXPLORER_BASE}/tx/${e.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: 'var(--text)' }}
                >
                  {shortHex(e.txHash)}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
