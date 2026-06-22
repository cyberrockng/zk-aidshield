import { describe, expect, it } from 'vitest';
import {
  AIDSHIELD_AFTER_SCORE,
  AIDSHIELD_BEFORE_SCORE,
  COMPETITIVE_PROJECTS,
  growthDelta,
  relativeLead,
} from '../lib/readiness-benchmark';

describe('readiness benchmark', () => {
  it('keeps AidShield ahead after the competitive edge package', () => {
    expect(growthDelta(AIDSHIELD_BEFORE_SCORE, AIDSHIELD_AFTER_SCORE)).toBe(8);

    for (const project of COMPETITIVE_PROJECTS) {
      expect(relativeLead(AIDSHIELD_AFTER_SCORE, project.after)).toBeGreaterThan(0);
    }
  });

  it('uses realistic bounded readiness percentages', () => {
    expect(AIDSHIELD_BEFORE_SCORE).toBeGreaterThanOrEqual(0);
    expect(AIDSHIELD_AFTER_SCORE).toBeLessThanOrEqual(100);
    expect(COMPETITIVE_PROJECTS.length).toBeGreaterThanOrEqual(5);

    for (const project of COMPETITIVE_PROJECTS) {
      expect(project.before).toBeGreaterThanOrEqual(0);
      expect(project.after).toBeLessThanOrEqual(100);
    }
  });
});
