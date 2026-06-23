import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Claim Aid — ZK AidShield',
  description:
    'Beneficiary claim flow for loading a private credential, generating a Groth16 proof, and claiming aid on Stellar.',
  alternates: { canonical: '/claim' },
};

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
