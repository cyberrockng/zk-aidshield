import Link from 'next/link';
import { CONTRACT_ID, EXPLORER_BASE, MERKLE_ROOT, VERIFIER_CONTRACT_ID, shortHex } from '@/lib/constants';

const steps = [
  {
    label: '01',
    title: 'Start at Command Center',
    href: '/command-center',
    action: 'Confirm the full product loop, proof system, verifier status, contract anchors, and live escrow state.',
    proof: 'Shows this is a Stellar ZK aid workflow, not a static pitch page.',
  },
  {
    label: '02',
    title: 'Fund aid as a donor',
    href: '/donor',
    action: 'Connect Freighter, fund the escrow, and create a donor proof-of-impact receipt.',
    proof: 'Completes the donor-to-escrow side of the humanitarian settlement loop.',
  },
  {
    label: '03',
    title: 'Issue a private claim pass',
    href: '/admin',
    action: 'Issue a wallet-bound credential, then export JSON or an encrypted QR delivery payload.',
    proof: 'The operator signs a private credential without publishing beneficiary PII.',
  },
  {
    label: '04',
    title: 'Claim with a ZK proof',
    href: '/claim',
    action: 'Load the credential, generate the Groth16 proof in-browser, sign with Freighter, and settle on Stellar.',
    proof: 'The proof is load-bearing: it gates contract payout and nullifier replay protection.',
  },
  {
    label: '05',
    title: 'Replay the same credential',
    href: '/claim',
    action: 'Attempt the same claim again and show the nullifier rejection path.',
    proof: 'Demonstrates fraud resistance rather than only a happy path.',
  },
  {
    label: '06',
    title: 'Verify the public receipt',
    href: '/receipt',
    action: 'Paste the receipt JSON and verify the transaction hash against Stellar testnet.',
    proof: 'Connects local receipt evidence to public settlement without exposing the witness.',
  },
  {
    label: '07',
    title: 'Finish with impact and audit',
    href: '/impact',
    action: 'Show paid claims, remaining capacity, privacy counters, and public anchors.',
    proof: 'Gives donors and auditors proof of impact without beneficiary identity disclosure.',
  },
];

export default function DemoPathPage() {
  return (
    <div className="space-y-8">
      <section className="section-panel">
        <div className="badge badge-green mb-4">Judge Demo Path</div>
        <h1 className="text-4xl font-bold mb-3">A 2-3 minute route through the strongest proof.</h1>
        <p className="text-sm leading-7 max-w-3xl" style={{ color: 'var(--muted-2)' }}>
          Use this page as the live submission checklist. It keeps the demo focused on the hackathon requirement:
          off-chain zero-knowledge proof generation, on-chain Stellar verification, real escrow settlement, replay
          protection, and public auditability without beneficiary PII.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm"
          >
            Disbursement contract
          </a>
          <a
            href={`${EXPLORER_BASE}/contract/${VERIFIER_CONTRACT_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm"
          >
            Verifier contract
          </a>
          <Link href="/claim" className="btn-primary text-sm">
            Start claim flow
          </Link>
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-5">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Public Anchors</h2>
          <div className="space-y-3 text-sm">
            {[
              ['Proof system', 'Groth16 BLS12-381'],
              ['Verifier mode', 'Soroban native pairing check'],
              ['Disbursement', shortHex(CONTRACT_ID)],
              ['Verifier', shortHex(VERIFIER_CONTRACT_ID)],
              ['Merkle root', shortHex(MERKLE_ROOT)],
              ['Video target', '2-3 minutes'],
            ].map(([label, value]) => (
              <div key={label} className="data-row">
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span className="mono text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-bold mb-4">What Judges Should See</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ['ZK is real work', 'A proof is generated before the contract pays.'],
              ['Stellar is real work', 'The Soroban contract verifies and settles on testnet.'],
              ['Privacy is real work', 'No credential secret, name, ID, or Merkle path is public.'],
              ['Fraud control is real work', 'Nullifier replay protection blocks reuse.'],
            ].map(([title, body]) => (
              <div key={title} className="privacy-panel">
                <div className="font-semibold mb-2" style={{ color: 'var(--green-bright)' }}>{title}</div>
                <p className="text-xs leading-6" style={{ color: 'var(--muted)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {steps.map((step) => (
          <Link key={`${step.label}-${step.href}`} href={step.href} className="route-card block hover:border-green-500 transition-colors">
            <div className="grid md:grid-cols-[70px_0.8fr_1fr_1fr] gap-4 items-start">
              <div className="badge badge-blue w-fit">{step.label}</div>
              <div>
                <div className="font-semibold">{step.title}</div>
                <div className="text-xs mt-1 mono" style={{ color: 'var(--muted)' }}>{step.href}</div>
              </div>
              <p className="text-sm leading-6" style={{ color: 'var(--muted-2)' }}>{step.action}</p>
              <p className="text-sm leading-6" style={{ color: 'var(--muted)' }}>{step.proof}</p>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
