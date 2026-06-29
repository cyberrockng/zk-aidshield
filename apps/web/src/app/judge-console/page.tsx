import Link from 'next/link';
import {
  CONTRACT_ID,
  DISBURSEMENT_ID,
  EXPLORER_BASE,
  MERKLE_ROOT,
  VERIFIER_CONTRACT_ID,
  shortHex,
} from '@/lib/constants';

const demoSteps = [
  {
    number: '01',
    title: 'Fund Escrow',
    href: '/donor',
    action: 'Open the donor portal, connect Freighter on Stellar testnet, and fund the campaign escrow.',
    proves: 'Real XLM is available before any beneficiary claim is attempted.',
    primary: true,
  },
  {
    number: '02',
    title: 'Issue Credential',
    href: '/admin',
    action: 'Use the admin console to issue a wallet-bound beneficiary credential for a registered campaign slot.',
    proves: 'Eligibility is represented as a signed private credential, not a public identity record.',
    primary: true,
  },
  {
    number: '03',
    title: 'Claim Privately',
    href: '/claim',
    action: 'Load the credential, generate the Groth16 proof in-browser, approve with Freighter, and settle on Stellar.',
    proves: 'The ZK proof is load-bearing: without it, the escrow contract cannot pay.',
    primary: true,
  },
  {
    number: '04',
    title: 'Show Receipt',
    href: '/receipt',
    action: 'Inspect the claim receipt: transaction hash, nullifier, amount, contract, verifier, and Merkle root.',
    proves: 'Donors and auditors get public accountability without beneficiary PII.',
    primary: false,
  },
  {
    number: '05',
    title: 'Try Reuse',
    href: '/claim',
    action: 'Load the same credential again and attempt another claim.',
    proves: 'The on-chain nullifier blocks replay and prevents double claiming.',
    primary: false,
  },
];

const evidenceLinks = [
  ['Protocol fit', '/protocol', 'Off-chain Circom proof, on-chain Soroban verification, XLM settlement.'],
  ['Evidence', '/evidence', 'Requirement map, contract anchors, video beats, and failure-path proof.'],
  ['Audit', '/audit', 'Trust boundaries, public settlement fields, and privacy limitations.'],
  ['Impact', '/impact', 'Escrow, paid claims, remaining capacity, and privacy counters.'],
];

export default function JudgeConsolePage() {
  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-green mb-4">Judge Demo Console</div>
        <h1 className="text-4xl font-bold mb-3">Private eligibility. Public Stellar settlement. No double claims.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          This is the focused route for judging ZK AidShield. Follow the flow in order:
          escrow is funded, a wallet-bound credential is issued, the beneficiary proves eligibility privately,
          Stellar settles the payout, and credential reuse fails.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/donor" className="btn-primary text-sm">
            Start: Fund Escrow
          </Link>
          <Link href="/admin" className="btn-outline text-sm">
            Issue Credential
          </Link>
          <Link href="/claim" className="btn-outline text-sm">
            Claim Privately
          </Link>
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm"
          >
            Contract ↗
          </a>
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Live Anchors</h2>
          <div className="space-y-3 text-sm">
            {[
              ['Network', 'Stellar Testnet'],
              ['Proof system', 'Groth16 BLS12-381'],
              ['Disbursement', shortHex(CONTRACT_ID)],
              ['Verifier', shortHex(VERIFIER_CONTRACT_ID)],
              ['Disbursement ID', shortHex(DISBURSEMENT_ID)],
              ['Merkle root', shortHex(MERKLE_ROOT)],
            ].map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="mono text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">What This Proves</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ['ZK gates payout', 'The browser proof must verify before escrow releases XLM.'],
              ['Eligibility stays private', 'Name, ID, secret, and Merkle path never go on-chain.'],
              ['Stellar settles publicly', 'Transaction, amount, contract, verifier, and nullifier are auditable.'],
              ['Reuse fails', 'The same credential cannot claim twice because the nullifier is already spent.'],
            ].map(([title, body]) => (
              <div key={title} className="privacy-panel">
                <div className="font-semibold mb-2" style={{ color: 'var(--green-bright)' }}>
                  {title}
                </div>
                <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {demoSteps.map((step) => (
          <Link
            key={step.number}
            href={step.href}
            className="route-card block hover:border-green-500 transition-colors"
          >
            <div className="grid md:grid-cols-[72px_0.7fr_1fr_1fr] gap-4 items-start">
              <div className={step.primary ? 'badge badge-green w-fit' : 'badge badge-blue w-fit'}>{step.number}</div>
              <div>
                <div className="font-semibold">{step.title}</div>
                <div className="text-xs mt-1 mono" style={{ color: 'var(--muted)' }}>
                  {step.href}
                </div>
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--muted-2)' }}>
                {step.action}
              </p>
              <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {step.proves}
              </p>
            </div>
          </Link>
        ))}
      </section>

      <section className="section-panel">
        <div className="flex items-start justify-between gap-5 flex-wrap mb-5">
          <div>
            <h2 className="text-2xl font-bold mb-2">Secondary Evidence</h2>
            <p className="text-sm max-w-2xl" style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              These pages stay available for deeper review, but the live demo should lead with the five-step console above.
            </p>
          </div>
          <Link href="/demo-path" className="btn-outline text-sm">
            Detailed Demo Path
          </Link>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {evidenceLinks.map(([title, href, body]) => (
            <Link key={href} href={href} className="route-card hover:border-green-500 transition-colors">
              <div className="font-semibold mb-2">{title}</div>
              <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>
                {body}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
