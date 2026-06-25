import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/demo-path',
  '/readiness',
  '/verification-lab',
  '/claim',
  '/receipt',
  '/impact',
] as const;

test.describe('accessibility smoke routes', () => {
  for (const route of routes) {
    test(`${route} has no detectable axe violations`, async ({ page }) => {
      await page.goto(route);
      await page.waitForTimeout(1200);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
