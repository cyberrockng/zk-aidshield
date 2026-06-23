import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Stats — ZK AidShield',
  description:
    'Live Stellar testnet stats, proof anchors, escrow state, and recent claim events for ZK AidShield.',
  alternates: { canonical: '/stats' },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
