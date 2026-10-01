import crypto from 'crypto';

export interface PreCheckOptions {
  title: string;
  description: string;
  recentFilingCount?: number;
}

export interface PreCheckResult {
  anomalyFlags: string[];
  preCheckSpamScore: number;
  contentHash: string;
  isFlaggedForReview: boolean;
}

const SPAM_URL_PATTERNS = [
  /https?:\/\/[^\s]+/i,
  /(bit\.ly|t\.me|wa\.me|tinyurl\.com)[^\s]*/i,
  /\b(free\s+bonus|crypto|casino|earn\s+money|cheap\s+rates|discount\s+today|buy\s+now)\b/i,
];

const REPETITIVE_PATTERNS = [
  /(.)\1{5,}/, // same character 6+ times e.g. "aaaaaa"
  /\b(\w+)\s+\1\s+\1\b/i, // same word repeated 3+ times e.g. "test test test"
];

/**
 * Computes a normalized SHA-256 hash of title + description to detect identical duplicate submissions
 */
export function hashComplaintContent(title: string, description: string): string {
  const normalized = `${title.trim().toLowerCase()}:::${description.trim().toLowerCase()}`;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Deterministic pre-checks pipeline (ARCHITECTURE.md §8.2)
 * Runs BEFORE the LLM to catch mechanical anomalies, spam bursts, and repetitive text
 */
export function performPreChecks(opts: PreCheckOptions): PreCheckResult {
  const { title, description, recentFilingCount = 0 } = opts;
  const combined = `${title} ${description}`.trim();
  const anomalyFlags: string[] = [];
  let spamScore = 0.0;

  // 1. Text Length check
  if (description.trim().length < 15) {
    anomalyFlags.push('TOO_SHORT');
    spamScore += 0.4;
    if (description.trim().length < 8) {
      anomalyFlags.push('INSUFFICIENT_DETAILS');
      spamScore += 0.4;
    }
  }

  // 2. High Filing Frequency check (Burst detection)
  if (recentFilingCount >= 5) {
    anomalyFlags.push('HIGH_FILING_RATE');
    spamScore += 0.4;
  }

  // 3. Commercial URL or link spam
  for (const pattern of SPAM_URL_PATTERNS) {
    if (pattern.test(combined)) {
      anomalyFlags.push('COMMERCIAL_OR_URL_SPAM');
      spamScore += 0.8;
      break;
    }
  }

  // 4. Repetitive / Gibberish text
  for (const pattern of REPETITIVE_PATTERNS) {
    if (pattern.test(combined)) {
      anomalyFlags.push('REPETITIVE_TEXT');
      spamScore += 0.8;
      break;
    }
  }

  // 5. Profanity-only or uppercase shouting
  const words = combined.split(/\s+/).filter(Boolean);
  const uppercaseWords = words.filter((w) => w.length > 2 && w === w.toUpperCase());
  if (words.length >= 2 && uppercaseWords.length / words.length > 0.8) {
    anomalyFlags.push('EXCESSIVE_UPPERCASE');
    spamScore += 0.3;
  }

  const finalSpamScore = Math.min(1.0, spamScore);
  const isFlaggedForReview = finalSpamScore >= 0.8 || anomalyFlags.length >= 2;

  return {
    anomalyFlags,
    preCheckSpamScore: finalSpamScore,
    contentHash: hashComplaintContent(title, description),
    isFlaggedForReview,
  };
}
