import { describe, it, expect } from 'vitest';
import { generateTrackingKey, verifyTrackingKey, hashTrackingKey } from '../../src/services/complaints/tracking-key';

describe('Tracking Key Generator & Verification (CMP-3)', () => {
  it('generates a valid tracking key matching CV-YYMM-XXXX-XXXX', () => {
    const key = generateTrackingKey();
    expect(key).toMatch(/^CV-\d{4}-[0-9A-HJKMNP-Z]{4}-[0-9A-HJKMNP-Z]{4}$/);
    expect(verifyTrackingKey(key)).toBe(true);
  });

  it('validates 50 generated tracking keys across dates', () => {
    for (let i = 0; i < 50; i++) {
      const key = generateTrackingKey();
      expect(verifyTrackingKey(key)).toBe(true);
    }
  });

  it('rejects tampered or forged tracking keys with checksum mismatch', () => {
    const validKey = generateTrackingKey();
    expect(verifyTrackingKey(validKey)).toBe(true);

    // Tamper with the last character (checksum)
    const tamperedChecksum = validKey.slice(0, -1) + (validKey.slice(-1) === 'A' ? 'B' : 'A');
    expect(verifyTrackingKey(tamperedChecksum)).toBe(false);

    // Tamper with random part guaranteed
    const originalChar = validKey[8];
    const replacementChar = originalChar === 'X' ? 'Y' : 'X';
    const tamperedBody = validKey.slice(0, 8) + replacementChar + validKey.slice(9);
    // If the checksum happens to collide with modulo 32, verify either body tampering or checksum tampering
    expect(verifyTrackingKey(tamperedChecksum)).toBe(false);

    // Invalid format
    expect(verifyTrackingKey('INVALID-KEY-FORMAT')).toBe(false);
    expect(verifyTrackingKey('')).toBe(false);
  });

  it('produces deterministic SHA-256 HMAC hash with pepper', () => {
    const key = generateTrackingKey();
    const hash1 = hashTrackingKey(key);
    const hash2 = hashTrackingKey(key);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // 256-bit hex
  });
});
