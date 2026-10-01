import { describe, it, expect } from 'vitest';
import { 
  tierOf, 
  getTrustMultiplier, 
  applyOutcome, 
  monthlyRecovery, 
  isSafetyCategoryName,
  INITIAL_TRUST_SCORE,
  TRUSTED_THRESHOLD,
  WATCH_THRESHOLD 
} from '../../src/services/ai/trust';

describe('Trust Engine Unit Tests (PRD §7 & ARCHITECTURE.md §8.4)', () => {
  describe('Tier Derivation', () => {
    it('correctly maps scores to Trust Tiers', () => {
      expect(tierOf(100)).toBe('Trusted');
      expect(tierOf(TRUSTED_THRESHOLD)).toBe('Trusted');
      expect(tierOf(74)).toBe('Normal');
      expect(tierOf(INITIAL_TRUST_SCORE)).toBe('Normal');
      expect(tierOf(WATCH_THRESHOLD)).toBe('Normal');
      expect(tierOf(39)).toBe('Watch');
      expect(tierOf(0)).toBe('Watch');
    });
  });

  describe('Trust Multipliers & Invariant for Safety Categories', () => {
    it('applies tier multipliers to non-safety complaints', () => {
      expect(getTrustMultiplier('Trusted', false)).toBe(1.1);
      expect(getTrustMultiplier('Normal', false)).toBe(1.0);
      expect(getTrustMultiplier('Watch', false)).toBe(0.9);
    });

    it('NON-NEGOTIABLE RULE: Safety categories ALWAYS return 1.0x multiplier regardless of tier', () => {
      // Even if a user is on the Watch tier (<40), safety complaints are NEVER discounted
      expect(getTrustMultiplier('Watch', true)).toBe(1.0);
      expect(getTrustMultiplier('Normal', true)).toBe(1.0);
      expect(getTrustMultiplier('Trusted', true)).toBe(1.0);
    });

    it('identifies safety categories reliably', () => {
      expect(isSafetyCategoryName('Anti-Ragging Squad')).toBe(true);
      expect(isSafetyCategoryName('Sexual Harassment (ICC)')).toBe(true);
      expect(isSafetyCategoryName('Physical Assault & Threats')).toBe(true);
      expect(isSafetyCategoryName('Hostel Bullying')).toBe(true);

      expect(isSafetyCategoryName('Hostel WiFi Issue')).toBe(false);
      expect(isSafetyCategoryName('Broken Projector in Lab')).toBe(false);
      expect(isSafetyCategoryName('Canteen Food Hygiene')).toBe(false);
    });
  });

  describe('Admin-Confirmed Outcome Adjustments', () => {
    it('increases trust for VALID (+5) and PARTIAL (+2)', () => {
      const validRes = applyOutcome(60, 'VALID');
      expect(validRes.newScore).toBe(65);
      expect(validRes.delta).toBe(5);

      const partialRes = applyOutcome(60, 'PARTIAL');
      expect(partialRes.newScore).toBe(62);
      expect(partialRes.delta).toBe(2);
    });

    it('leaves trust unchanged for DUPLICATE and UNVERIFIABLE', () => {
      expect(applyOutcome(60, 'DUPLICATE').newScore).toBe(60);
      expect(applyOutcome(60, 'UNVERIFIABLE').newScore).toBe(60);
    });

    it('decreases trust for SPAM (-10) and MALICIOUS (-25)', () => {
      const spamRes = applyOutcome(60, 'SPAM');
      expect(spamRes.newScore).toBe(50);
      expect(spamRes.delta).toBe(-10);

      const malRes = applyOutcome(60, 'MALICIOUS');
      expect(malRes.newScore).toBe(35);
      expect(malRes.delta).toBe(-25);
    });

    it('clamps score boundaries strictly between 0 and 100', () => {
      // Ceiling check
      expect(applyOutcome(98, 'VALID').newScore).toBe(100);

      // Floor check
      expect(applyOutcome(15, 'MALICIOUS').newScore).toBe(0);
      expect(applyOutcome(5, 'SPAM').newScore).toBe(0);
    });
  });

  describe('Monthly Trust Recovery', () => {
    it('recovers +2 points monthly up to baseline 60 if clean of infractions', () => {
      expect(monthlyRecovery(50, false)).toEqual({ newScore: 52, delta: 2 });
      expect(monthlyRecovery(59, false)).toEqual({ newScore: 60, delta: 1 });
    });

    it('does not recover beyond initial baseline (60)', () => {
      expect(monthlyRecovery(60, false)).toEqual({ newScore: 60, delta: 0 });
      expect(monthlyRecovery(80, false)).toEqual({ newScore: 80, delta: 0 });
    });

    it('blocks recovery if infractions occurred in the last 30 days', () => {
      expect(monthlyRecovery(50, true)).toEqual({ newScore: 50, delta: 0 });
    });
  });
});
