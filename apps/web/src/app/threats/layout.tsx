import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Threat Controls — ZK AidShield',
  description:
    'Threat-resistance dashboard for issuer revocation, vendor controls, replay protection, escrow health, and governance posture.',
  alternates: { canonical: '/threats' },
};

export default function ThreatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
