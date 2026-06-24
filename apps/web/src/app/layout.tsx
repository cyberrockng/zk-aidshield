import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { CONTRACT_ID, EXPLORER_BASE } from '@/lib/constants';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://zk-aidshield.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'ZK AidShield — Privacy-Preserving Aid Distribution',
  description:
    'Groth16 BLS12-381 zero-knowledge proof system for anonymous humanitarian aid disbursement on Stellar Soroban.',
  applicationName: 'ZK AidShield',
  keywords: [
    'Stellar',
    'Soroban',
    'zero knowledge',
    'Groth16',
    'humanitarian aid',
    'privacy',
    'DoraHacks',
    'Stellar Hacks',
  ],
  authors: [{ name: 'ZK AidShield' }],
  creator: 'ZK AidShield',
  publisher: 'ZK AidShield',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ZK AidShield',
    title: 'ZK AidShield — Privacy-Preserving Aid Distribution',
    description:
      'Private humanitarian aid claims on Stellar with Groth16 BLS12-381 verification, replay protection, and accountable settlement.',
  },
  twitter: {
    card: 'summary',
    title: 'ZK AidShield — Privacy-Preserving Aid Distribution',
    description:
      'Private humanitarian aid claims on Stellar with Groth16 BLS12-381 verification and accountable settlement.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <nav
          aria-label="Primary navigation"
          style={{
            borderBottom: '1px solid var(--border-dim)',
            background: 'rgba(13, 17, 23, 0.85)',
            backdropFilter: 'blur(12px)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-base" aria-label="ZK AidShield home">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <path
                  d="M11 1L20 6V16L11 21L2 16V6L11 1Z"
                  stroke="var(--green)"
                  strokeWidth="1.5"
                  fill="rgba(63,185,80,0.08)"
                />
                <path
                  d="M8 11L10.5 13.5L14.5 9"
                  stroke="var(--green-bright)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
                ZK <span style={{ color: 'var(--green)' }}>AidShield</span>
              </span>
            </Link>

            <div className="flex items-center gap-1 flex-wrap justify-end">
              <Link
                href="/judges"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Judges
              </Link>
              <Link
                href="/auditor"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Auditor
              </Link>
              <Link
                href="/audit"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Audit
              </Link>
              <Link
                href="/threats"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Threats
              </Link>
              <Link
                href="/edge"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Edge
              </Link>
              <Link
                href="/mission"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Mission
              </Link>
              <Link
                href="/evidence"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Evidence
              </Link>
              <Link
                href="/protocol"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Protocol
              </Link>
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--muted)' }}
              >
                Admin
              </Link>
              <Link
                href="/claim"
                className="btn-primary text-sm ml-3"
                style={{ padding: '6px 18px', borderRadius: 8 }}
              >
                Claim Aid
              </Link>
            </div>
          </div>
        </nav>

        <main id="main-content" className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">{children}</main>

        <footer
          style={{
            borderTop: '1px solid var(--border-dim)',
            background: 'var(--surface)',
          }}
        >
          <div
            className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-xs"
            style={{ color: 'var(--muted)' }}
          >
            <div className="flex items-center gap-2">
              <span className="live-dot" />
              <span>Live on Stellar Testnet · Groth16 BLS12-381</span>
            </div>
            <div className="flex gap-4">
              <a
                href="https://dorahacks.io/hackathon/stellar-hacks-zk"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Stellar Hacks: Real-World ZK
              </a>
              <a
                href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Contract ↗
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
