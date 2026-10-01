import { describe, it, expect } from 'vitest';
import { encryptUserId, decryptUserId } from '../../src/services/vault/crypto';

describe('Vault AES-256-GCM Cryptography (ARCHITECTURE.md §5)', () => {
  it('encrypts and decrypts user ID accurately', () => {
    const userId = 'usr_98f7c0a1-2b3c-4d5e-6f7a-8b9c0d1e2f3a';
    const encrypted = encryptUserId(userId);

    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(userId);

    const decrypted = decryptUserId(encrypted);
    expect(decrypted).toBe(userId);
  });

  it('generates unique ciphertexts for repeated encryptions (unique IV)', () => {
    const userId = 'usr_constant_id_123';
    const enc1 = encryptUserId(userId);
    const enc2 = encryptUserId(userId);

    expect(enc1).not.toBe(enc2); // Unique IV per encryption
    expect(decryptUserId(enc1)).toBe(userId);
    expect(decryptUserId(enc2)).toBe(userId);
  });

  it('fails decryption if ciphertext or authentication tag is tampered with', () => {
    const userId = 'usr_sensitive_identity';
    const encrypted = encryptUserId(userId);

    const buf = Buffer.from(encrypted, 'base64');
    // Tamper with the last byte
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff;
    const tampered = buf.toString('base64');

    expect(() => decryptUserId(tampered)).toThrow();
  });
});
