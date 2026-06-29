import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { requireRateLimit } from '@/lib/rate-limit';
import { resetIssuanceForCampaign } from '@/lib/issuance-ledger-store';

interface CampaignClaim {
  index?: number;
  leaf_index?: number;
  claimant_address: string;
}

interface Campaign {
  disbursement_id: string;
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

function claimIndex(claim: CampaignClaim): number {
  const index = claim.index ?? claim.leaf_index;
  if (typeof index !== 'number') throw new Error('Campaign claim is missing index/leaf_index');
  return index;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdmin(req);
  if (authError) return authError;
  const rateLimitError = requireRateLimit(req, 'admin:reset-issuance', 3);
  if (rateLimitError) return rateLimitError;

  const campaign = loadCampaign();
  let override: { campaign_id?: string; slots?: Array<{ slot_index?: number; claimant_address?: string }> } = {};
  try {
    override = await req.json() as typeof override;
  } catch {
    // Body is optional; default to the configured campaign.
  }

  const campaignId = override.campaign_id ?? campaign.disbursement_id;
  let slots: Array<{ slot_index: number; claimant_address: string }>;
  try {
    slots = Array.isArray(override.slots) && override.slots.length > 0
      ? override.slots.map((slot) => {
        if (
          typeof slot.slot_index !== 'number' ||
          !Number.isInteger(slot.slot_index) ||
          slot.slot_index < 0 ||
          typeof slot.claimant_address !== 'string'
        ) {
          throw new Error('slots must contain a non-negative integer slot_index and claimant_address');
        }
        return { slot_index: slot.slot_index, claimant_address: slot.claimant_address };
      })
      : campaign.claims.map((claim) => ({
        slot_index: claimIndex(claim),
        claimant_address: claim.claimant_address,
      }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }

  const result = await resetIssuanceForCampaign(
    campaignId,
    slots,
  );

  return NextResponse.json({
    ok: true,
    campaign_id: campaignId,
    slots: slots.length,
    ...result,
  });
}
