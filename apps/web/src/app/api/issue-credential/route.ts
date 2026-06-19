/**
 * POST /api/issue-credential
 *
 * Operator-facing API that issues a signed beneficiary credential for a given
 * claimant wallet address. The signing key lives only here (server-side);
 * it is never bundled into the client.
 *
 * Body: { claimant_address: string }
 * Returns: BeneficiaryCredential JSON
 *
 * Security properties:
 *  - campaign.json is read server-side — secrets never reach the browser
 *  - Each slot is tracked and can only be issued once per process lifetime
 *  - The credential binds claimant_address so the signature won't verify for
 *    any other wallet
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Keypair } from '@stellar/stellar-sdk';
import type { BeneficiaryCredential } from '@/lib/credential';
import { credentialSigningPayload } from '@/lib/credential';
import { ISSUER_KEY_ID, ISSUER_PUBLIC_KEY } from '@/lib/constants';
import { appendIssuanceLedgerEntry } from '@/lib/issuance-ledger-store';
import { NextRequest, NextResponse } from 'next/server';

// ── Issuer keypair (demo — never expose in client bundle) ──────────────────
// In production, read from ISSUER_SECRET_KEY env var via a secret manager.
const ISSUER_SECRET = process.env.ISSUER_SECRET_KEY ?? 'SBMF2UKOVBCU5XG24BBQMCXF4QFGNUHMBMHH6HQO4NEMF6MKTDWN5XKU';
const ISSUER_PUBLIC = ISSUER_PUBLIC_KEY;

// ── Campaign data (server-side only) ──────────────────────────────────────
interface CampaignClaim {
  index: number;
  claimant_address: string; // wallet pre-committed in this slot's leaf
  secret: string;
  leaf: string;
  merkle_path: string[];
  path_indices: boolean[];
  expires_at?: number;
  issuer_key_id?: string;
}

interface Campaign {
  disbursement_id: string;
  merkle_root: string;
  expires_at?: number;
  issuer_key_id?: string;
  claims: CampaignClaim[];
}

function loadCampaign(): Campaign {
  // Path relative to Next.js CWD (apps/web)
  const paths = [
    join(process.cwd(), '../../packages/merkle-tools/campaign.json'),
    join(process.cwd(), 'campaign.json'),
  ];
  for (const p of paths) {
    try {
      return JSON.parse(readFileSync(p, 'utf-8')) as Campaign;
    } catch {
      // try next path
    }
  }
  throw new Error('campaign.json not found — run generate-campaign first');
}

// In-memory issue tracking (resets on restart — acceptable for demo)
const issuedSlots = new Set<number>();
const issuedWallets = new Set<string>();

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { claimant_address?: string };
  try {
    body = await req.json() as { claimant_address?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { claimant_address } = body;
  if (!claimant_address || typeof claimant_address !== 'string') {
    return NextResponse.json({ error: 'claimant_address is required' }, { status: 400 });
  }

  // Basic Stellar address format check (56-char StrKey starting with G)
  if (!/^G[A-Z0-9]{55}$/.test(claimant_address)) {
    return NextResponse.json({ error: 'Invalid Stellar address format' }, { status: 400 });
  }

  // Load campaign
  let campaign: Campaign;
  try {
    campaign = loadCampaign();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  // Phase 4: the leaf is wallet-, expiry-, and issuer-bound — find the slot
  // pre-committed to this exact address.
  const slot = campaign.claims.find((c) => c.claimant_address === claimant_address);
  if (!slot) {
    return NextResponse.json(
      { error: 'This wallet is not registered in the campaign. Only pre-approved wallets can receive credentials.' },
      { status: 404 },
    );
  }

  // Prevent re-issuing to the same wallet (slot already issued in this session)
  if (issuedSlots.has(slot.index) || issuedWallets.has(claimant_address)) {
    return NextResponse.json(
      { error: 'A credential has already been issued to this wallet in this session' },
      { status: 409 },
    );
  }

  // Build credential (without signature)
  const now = Math.floor(Date.now() / 1000);
  const expires_at = slot.expires_at ?? campaign.expires_at ?? now + 30 * 24 * 3600;
  const issuer_key_id = slot.issuer_key_id ?? campaign.issuer_key_id ?? ISSUER_KEY_ID;
  const credBase: Omit<BeneficiaryCredential, 'issuer_signature'> = {
    version: '2',
    campaign_id: campaign.disbursement_id,
    claimant_address,
    slot_index: slot.index,
    secret: slot.secret,
    leaf_index: slot.index,
    merkle_path: slot.merkle_path,
    path_indices: slot.path_indices,
    issued_at: now,
    expires_at,
    issuer_key_id,
    issuer_public_key: ISSUER_PUBLIC,
  };

  // Sign: Ed25519 over SHA-256 of the canonical payload
  const payload = credentialSigningPayload(credBase);
  const msgHash = createHash('sha256').update(payload).digest();
  const issuerKP = Keypair.fromSecret(ISSUER_SECRET);
  const sigBytes = issuerKP.sign(msgHash);
  const issuer_signature = Buffer.from(sigBytes).toString('hex');

  const credential: BeneficiaryCredential = { ...credBase, issuer_signature };
  appendIssuanceLedgerEntry(credential);

  // Mark slot + wallet as issued
  issuedSlots.add(slot.index);
  issuedWallets.add(claimant_address);

  return NextResponse.json(credential, { status: 200 });
}
