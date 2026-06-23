import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Auditor Dashboard — ZK AidShield',
  description:
    'Auditor-facing view of ZK AidShield escrow, deployed contracts, proof anchors, and privacy boundaries.',
  alternates: { canonical: '/auditor' },
};

export default function AuditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
