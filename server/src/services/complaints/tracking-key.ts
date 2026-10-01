import crypto from 'crypto';

// Crockford's Base32 alphabet (32 characters: excludes I, L, O, U)
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const PEPPER = process.env.TRACKING_KEY_PEPPER || 'campusvoice-default-pepper';

/**
 * Calculates a Crockford Base32 checksum character for a given string of Crockford chars.
 */
function calculateChecksum(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload[i];
    const val = CROCKFORD_ALPHABET.indexOf(char);
    if (val !== -1) {
      sum = (sum * 37 + val) % 32;
    }
  }
  return CROCKFORD_ALPHABET[sum % 32];
}

/**
 * Generates 7 random Crockford Base32 characters
 */
function randomCrockford(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randIndex = crypto.randomInt(0, CROCKFORD_ALPHABET.length);
    result += CROCKFORD_ALPHABET[randIndex];
  }
  return result;
}

/**
 * Generates a Unique Tracking Key (CMP-3, ARCHITECTURE.md §5)
 * Format: CV-YYMM-XXXX-XXXX
 * where XXXX-XXX is 7 random Crockford chars and the final char is the checksum.
 */
export function generateTrackingKey(date = new Date()): string {
  const yy = date.getFullYear().toString().slice(-2);
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yymm = `${yy}${mm}`;

  const rand7 = randomCrockford(7); // 7 random Crockford chars
  const payloadForChecksum = `${yymm}${rand7}`;
  const checksum = calculateChecksum(payloadForChecksum);

  // Group: 4 chars - 3 chars + checksum (total 8 chars in random segment)
  const part1 = rand7.slice(0, 4);
  const part2 = `${rand7.slice(4, 7)}${checksum}`;

  return `CV-${yymm}-${part1}-${part2}`;
}

/**
 * Validates tracking key format and checksum
 */
export function verifyTrackingKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;

  const normalized = key.trim().toUpperCase();
  const match = normalized.match(/^CV-(\d{4})-([0-9A-HJKMNP-Z]{4})-([0-9A-HJKMNP-Z]{4})$/);
  if (!match) return false;

  const yymm = match[1];
  const part1 = match[2];
  const part2 = match[3];

  const rand7 = `${part1}${part2.slice(0, 3)}`;
  const providedChecksum = part2.slice(3);

  const expectedChecksum = calculateChecksum(`${yymm}${rand7}`);
  return providedChecksum === expectedChecksum;
}

/**
 * Produces deterministic SHA-256 HMAC hash of the tracking key with pepper.
 * ONLY this hash is stored in the complaints database table!
 */
export function hashTrackingKey(key: string): string {
  const normalized = key.trim().toUpperCase();
  return crypto.createHmac('sha256', PEPPER).update(normalized).digest('hex');
}
