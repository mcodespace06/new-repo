import { describe, it, expect } from 'vitest';
import fixtures from '../fixtures/complaints-eval.json';
import { performPreChecks } from '../../src/services/ai/prechecks';
import { calculateDeterministicPriority } from '../../src/services/ai/analyze';
import { isSafetyCategoryName, getTrustMultiplier } from '../../src/services/ai/trust';
import { Priority } from '@prisma/client';

describe('AI Analysis Pipeline Evals & Safety Invariants (~30 Fixtures)', () => {
  it('contains exactly 30 diverse evaluation fixtures', () => {
    expect(fixtures.length).toBe(30);
  });

  describe('Safety Category Invariant & Hard Floor Rules', () => {
    it('correctly identifies all safety category complaints', () => {
      const safetyFixtures = fixtures.filter((f) => f.expectedSafety);
      expect(safetyFixtures.length).toBe(10);

      for (const item of safetyFixtures) {
        const isSafety = isSafetyCategoryName(item.category);
        expect(isSafety).toBe(true);
      }
    });

    it('guarantees trust multiplier is ALWAYS 1.0x for safety complaints even on Watch tier', () => {
      const safetyFixtures = fixtures.filter((f) => f.expectedSafety);
      for (const item of safetyFixtures) {
        const multiplier = getTrustMultiplier('Watch', true);
        expect(multiplier).toBe(1.0);
      }
    });

    it('enforces that active violence, ragging, and harassment are assigned at least HIGH priority', () => {
      const priority = calculateDeterministicPriority({
        categoryWeight: 5,
        severityScore: 8,
        urgencySignals: ['PHYSICAL_VIOLENCE', 'RAGGING_ACTIVE'],
        reporterTier: 'Watch',
        isSafetyCategory: true,
      });

      expect(priority === Priority.HIGH || priority === Priority.CRITICAL).toBe(true);
    });

    it('enforces that imminent danger, weapons, or self-harm are ALWAYS assigned CRITICAL priority', () => {
      const weaponPriority = calculateDeterministicPriority({
        categoryWeight: 4,
        severityScore: 9,
        urgencySignals: ['WEAPON', 'IMMINENT_DANGER'],
        reporterTier: 'Watch',
        isSafetyCategory: true,
      });

      expect(weaponPriority).toBe(Priority.CRITICAL);

      const selfHarmPriority = calculateDeterministicPriority({
        categoryWeight: 4,
        severityScore: 9,
        urgencySignals: ['SELF_HARM'],
        reporterTier: 'Watch',
        isSafetyCategory: true,
      });

      expect(selfHarmPriority).toBe(Priority.CRITICAL);
    });
  });

  describe('Spam & Anomaly Detection on Fixtures', () => {
    it('accurately detects commercial URL spam, gibberish, and repetitive text', () => {
      const spamFixtures = fixtures.filter((f) => f.isSpam);
      expect(spamFixtures.length).toBe(6);

      for (const item of spamFixtures) {
        const result = performPreChecks({
          title: item.title,
          description: item.description,
        });

        expect(result.isFlaggedForReview).toBe(true);
        expect(result.anomalyFlags.length).toBeGreaterThan(0);
      }
    });

    it('does NOT flag legitimate safety or infrastructure complaints as spam', () => {
      const validFixtures = fixtures.filter((f) => !f.isSpam);
      for (const item of validFixtures) {
        const result = performPreChecks({
          title: item.title,
          description: item.description,
        });

        expect(result.isFlaggedForReview).toBe(false);
      }
    });
  });
});
