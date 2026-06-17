import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { CONTRACT_ID, EXPLORER_BASE } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'ZK AidShield — Privacy-Preserving Aid Distribution',
  description:
    'Zero-knowledge proof system for anonymous aid disbursement on Stellar. Built for Stellar Hacks: Real-World ZK.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-base">
              <span style={{ color: 'var(--green)' }}>⬡</span>
              <span>ZK AidShield</span>
            </Link>
            <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--muted)' }}>
              <Link href="/stats" className="hover:text-white transition-colors">
                Stats
              </Link>
              <Link href="/admin" className="hover:text-white transition-colors">
                Admin
              </Link>
              <Link
                href="/claim"
                className="btn-primary text-sm"
                style={{ padding: '6px 16px' }}
              >
                Claim Aid
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
        <footer
          className="text-center py-8 text-xs"
          style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}
        >
          Built for{' '}
          <a
            href="https://dorahacks.io/hackathon/stellar-hacks-zk"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Stellar Hacks: Real-World ZK
          </a>{' '}
          · Soroban Testnet ·{' '}
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Contract
          </a>
        </footer>
      </body>
    </html>
  );
}
