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
 *  - campaign.json is read server-side and the issuer key is never bundled into the client
 *  - The returned credential intentionally contains the secret and Merkle witness for local proving
 *  - Each slot/wallet is reserved before issuance; production can use Upstash Redis SET NX for durable uniqueness
 *  - The credential binds claimant_address so the signature won't verify for
 *    any other wallet
 */

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import type { BeneficiaryCredential } from '@/lib/credential';
import { credentialSigningPayload } from '@/lib/credential';
import { ISSUER_KEY_ID, ISSUER_PUBLIC_KEY } from '@/lib/constants';
import { appendIssuanceLedgerEntry, reserveIssuance } from '@/lib/issuance-ledger-store';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

// ── Issuer keypair (server-side only; never expose in client bundle) ───────
const ISSUER_PUBLIC = ISSUER_PUBLIC_KEY;

function issuerSecret(): string {
  const secret = process.env.ISSUER_SECRET_KEY;
  if (!secret) throw new Error('ISSUER_SECRET_KEY is not configured on the server');
  return secret;
}

// ── Campaign data (server-side only) ──────────────────────────────────────
interface CampaignClaim {
  index?: number;
  leaf_index?: number;
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
  if (process.env.CAMPAIGN_JSON) {
    return JSON.parse(process.env.CAMPAIGN_JSON) as Campaign;
  }

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
  throw new Error('CAMPAIGN_JSON env var or campaign.json file is required — run generate-campaign first');
}

function claimIndex(claim: CampaignClaim): number {
  const index = claim.index ?? claim.leaf_index;
  if (typeof index !== 'number') throw new Error('Campaign claim is missing index/leaf_index');
  return index;
}

// Extra same-process guard. Durable production uniqueness is handled by reserveIssuance().
const issuedSlots = new Set<number>();
const issuedWallets = new Set<string>();

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const rateLimitError = requireRateLimit(req, 'issue-credential', 12);
  if (rateLimitError) return rateLimitError;

  let body: { claimant_address?: string; dry_run?: boolean };
  try {
    body = await req.json() as { claimant_address?: string; dry_run?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { claimant_address } = body;
  if (!claimant_address || typeof claimant_address !== 'string') {
    return NextResponse.json({ error: 'claimant_address is required' }, { status: 400 });
  }

  if (!StrKey.isValidEd25519PublicKey(claimant_address)) {
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
  let slotIndex: number;
  try {
    slotIndex = claimIndex(slot);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  // Prevent re-issuing to the same wallet (fast same-process guard).
  if (issuedSlots.has(slotIndex) || issuedWallets.has(claimant_address)) {
    return NextResponse.json(
      { error: 'A credential has already been issued to this wallet in this session' },
      { status: 409 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const expires_at = slot.expires_at ?? campaign.expires_at ?? now + 30 * 24 * 3600;
  const issuer_key_id = slot.issuer_key_id ?? campaign.issuer_key_id ?? ISSUER_KEY_ID;

  if (body.dry_run === true) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      message: 'Credential issuance is configured and this wallet has an available campaign slot. No credential was signed or reserved.',
      campaign_id: campaign.disbursement_id,
      merkle_root: campaign.merkle_root,
      slot_index: slotIndex,
      claimant_address,
      expires_at,
      issuer_key_id,
      issuer_public_key: ISSUER_PUBLIC,
    });
  }

  let issuerKP: Keypair;
  try {
    issuerKP = Keypair.fromSecret(issuerSecret());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 503 });
  }

  let reservation;
  try {
    reservation = await reserveIssuance(campaign.disbursement_id, slotIndex, claimant_address);
  } catch (e) {
    return NextResponse.json({ error: `Issuance reservation failed: ${String(e)}` }, { status: 503 });
  }
  if (!reservation.ok) {
    return NextResponse.json(
      { error: `A credential has already been issued for this ${reservation.reason === 'slot_already_issued' ? 'slot' : 'wallet'}` },
      { status: 409 },
    );
  }

  // Build credential (without signature)
  const credBase: Omit<BeneficiaryCredential, 'issuer_signature'> = {
    version: '2',
    campaign_id: campaign.disbursement_id,
    claimant_address,
    slot_index: slotIndex,
    secret: slot.secret,
    leaf_index: slotIndex,
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
  const sigBytes = issuerKP.sign(msgHash);
  const issuer_signature = Buffer.from(sigBytes).toString('hex');

  const credential: BeneficiaryCredential = { ...credBase, issuer_signature };
  try {
    await appendIssuanceLedgerEntry(credential);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          `Credential was reserved but the issuance ledger could not be written: ${String(e)}. ` +
          'Operator recovery: inspect durable reservation state before retrying this wallet.',
      },
      { status: 503 },
    );
  }

  // Mark slot + wallet as issued
  issuedSlots.add(slotIndex);
  issuedWallets.add(claimant_address);

  return NextResponse.json(credential, { status: 200 });
}
