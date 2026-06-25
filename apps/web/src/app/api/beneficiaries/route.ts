/**
 * GET /api/beneficiaries
 *
 * Returns the list of pre-registered beneficiary wallets from campaign.json,
 * without exposing any secrets or private witnesses. Used by the admin
 * dashboard to show registered slots and issue credentials in bulk.
 *
 * Response: { disbursement_id, merkle_root, slots: [{ index, claimant_address }] }
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

interface CampaignClaim {
  index: number;
  claimant_address: string;
}

interface Campaign {
  disbursement_id: string;
  merkle_root: string;
  claims: CampaignClaim[];
}

function loadCampaign(): Campaign {
  if (process.env.CAMPAIGN_JSON) {
    return JSON.parse(process.env.CAMPAIGN_JSON) as Campaign;
  }

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
  throw new Error('CAMPAIGN_JSON env var or campaign.json file is required');
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const rateLimitError = requireRateLimit(req, 'beneficiaries', 30);
  if (rateLimitError) return rateLimitError;

  try {
    const campaign = loadCampaign();
    return NextResponse.json({
      disbursement_id: campaign.disbursement_id,
      merkle_root: campaign.merkle_root,
      total_slots: campaign.claims.length,
      slots: campaign.claims.map((c) => ({
        index: c.index,
        claimant_address: c.claimant_address,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), slots: [] },
      { status: 404 },
    );
  }
}
