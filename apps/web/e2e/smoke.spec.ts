import { expect, test } from '@playwright/test';

const routes = [
  ['/', 'Private aid eligibility'],
  ['/demo-path', 'Judge Demo Path'],
  ['/command-center', 'AidShield Command Center'],
  ['/donor', 'Donor Escrow Portal'],
  ['/campaign-builder', 'Download beneficiaries.json'],
  ['/claim-pass', 'Beneficiary Claim Pass'],
  ['/receipt', 'Receipt Summary'],
  ['/impact', 'Impact Dashboard'],
  ['/readiness', '100%+ Readiness Board'],
  ['/verification-lab', 'Verification Lab'],
] as const;

test.describe('judge-facing smoke routes', () => {
  for (const [route, text] of routes) {
    test(`${route} renders`, async ({ page }) => {
      await page.goto(route);
      await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
    });
  }
});

test('credential issuance endpoint requires admin authentication', async ({ request }) => {
  const response = await request.post('/api/issue-credential', {
    data: { claimant_address: 'GD7KEWXME3KNSEUZIZZZEHTXC5AQCQOZLL2TTKQGR2OBXA2YJBXM7WQS', dry_run: true },
  });
  expect(response.status()).toBe(401);
});
