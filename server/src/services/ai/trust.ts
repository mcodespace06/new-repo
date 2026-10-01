import { Outcome } from '@prisma/client';

export type TrustTier = 'Trusted' | 'Normal' | 'Watch';

export const INITIAL_TRUST_SCORE = 60;
export const TRUSTED_THRESHOLD = 75;
export const WATCH_THRESHOLD = 40;

const SAFETY_KEYWORDS = [
  'ragging',
  'harassment',
  'sexual',
  'assault',
  'violence',
  'threat',
  'safety',
  'weapon',
  'bully',
  'stalking',
];

/**
 * Determines whether a complaint category represents a safety or disciplinary issue
 * where trust scores MUST NOT discount or downgrade priority (PRD §7 & ARCHITECTURE.md §8.2)
 */
export function isSafetyCategoryName(categoryName: string): boolean {
  if (!categoryName) return false;
  const lower = categoryName.toLowerCase();
  return SAFETY_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Derives the reporter's trust tier from their numerical score
 */
export function tierOf(score: number): TrustTier {
  if (score >= TRUSTED_THRESHOLD) return 'Trusted';
  if (score >= WATCH_THRESHOLD) return 'Normal';
  return 'Watch';
}

/**
 * Calculates priority multiplier based on trust tier.
 * CRITICAL INVARIANT: Safety categories ALWAYS return 1.0x regardless of reporter tier.
 */
export function getTrustMultiplier(tier: TrustTier, isSafetyCategory = false): number {
  if (isSafetyCategory) {
    return 1.0;
  }

  switch (tier) {
    case 'Trusted':
      return 1.1;
    case 'Normal':
      return 1.0;
    case 'Watch':
      return 0.9;
    default:
      return 1.0;
  }
}

/**
 * Applies an admin-confirmed outcome to update the reporter's trust score.
 * Non-negotiable rule: Trust score changes ONLY occur after human admin resolution.
 * Score is strictly bounded between 0 and 100.
 */
export function applyOutcome(currentScore: number, outcome: Outcome): { newScore: number; delta: number } {
  let delta = 0;

  switch (outcome) {
    case 'VALID':
      delta = 5;
      break;
    case 'PARTIAL':
      delta = 2;
      break;
    case 'DUPLICATE':
    case 'UNVERIFIABLE':
      delta = 0;
      break;
    case 'SPAM':
      delta = -10;
      break;
    case 'MALICIOUS':
      delta = -25;
      break;
    default:
      delta = 0;
  }

  const rawScore = currentScore + delta;
  const newScore = Math.max(0, Math.min(100, rawScore));

  return {
    newScore,
    delta: newScore - currentScore,
  };
}

/**
 * Monthly trust score recovery (PRD §7):
 * If score < 60 and no SPAM/MALICIOUS infractions occurred in the last 30 days,
 * score recovers by +2 points per month up to a maximum of 60.
 */
export function monthlyRecovery(
  currentScore: number,
  hasInfractionInLast30Days: boolean
): { newScore: number; delta: number } {
  if (hasInfractionInLast30Days || currentScore >= INITIAL_TRUST_SCORE) {
    return { newScore: currentScore, delta: 0 };
  }

  const newScore = Math.min(INITIAL_TRUST_SCORE, currentScore + 2);
  return {
    newScore,
    delta: newScore - currentScore,
  };
}
