import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/services/auth/passwords';
import { generateOTP, hashOTP, verifyOTPHash, getOTPExpiry } from '../../src/services/auth/otp';
import { signToken, verifyToken } from '../../src/services/auth/tokens';
import { Role } from '@prisma/client';

describe('Auth Cryptographic Utilities (AUTH-1, AUTH-2)', () => {
  it('hashes passwords using Argon2id and verifies match', async () => {
    const plain = 'StrongPassword@2026!';
    const hash = await hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash.startsWith('$argon2id$')).toBe(true);

    const match = await verifyPassword(hash, plain);
    expect(match).toBe(true);

    const wrongMatch = await verifyPassword(hash, 'WrongPassword123');
    expect(wrongMatch).toBe(false);
  });

  it('generates a 6-digit numeric OTP', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    }
  });

  it('hashes and securely verifies OTP', () => {
    const otp = generateOTP();
    const hash = hashOTP(otp);

    expect(hash).toHaveLength(64); // SHA-256 hex string
    expect(verifyOTPHash(otp, hash)).toBe(true);
    expect(verifyOTPHash('999999', hash)).toBe(false);
  });

  it('calculates 10-minute expiry correctly', () => {
    const now = Date.now();
    const expiry = getOTPExpiry(10);
    const diffMs = expiry.getTime() - now;

    // ~10 minutes (600,000 ms) with slight delta tolerance
    expect(diffMs).toBeGreaterThanOrEqual(599000);
    expect(diffMs).toBeLessThanOrEqual(601000);
  });

  it('signs and decodes valid JWT sessions', () => {
    const user = {
      id: 'test-user-uuid',
      username: 'testuser',
      role: Role.STUDENT,
      status: 'ACTIVE',
      collegeEmail: 'testuser@campus.edu',
      department: 'Computer Science',
    };

    const token = signToken(user);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded).toBeDefined();
    expect(decoded?.id).toBe(user.id);
    expect(decoded?.username).toBe(user.username);
    expect(decoded?.role).toBe(user.role);

    const invalidDecoded = verifyToken('invalid.jwt.token');
    expect(invalidDecoded).toBeNull();
  });
});
