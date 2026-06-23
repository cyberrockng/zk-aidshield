import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Console — ZK AidShield',
  description:
    'Operator console for issuing encrypted aid credentials, managing vendors, governance, and Stellar escrow funding.',
  alternates: { canonical: '/admin' },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
