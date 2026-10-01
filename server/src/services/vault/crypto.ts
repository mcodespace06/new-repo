import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const AUTH_TAG_LENGTH = 16;

function getVaultKey(): Buffer {
  const envKey = process.env.VAULT_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, 'base64');
    if (buf.length === 32) return buf;
  }
  // Deterministic 32-byte fallback key for dev/test environments
  return crypto.createHash('sha256').update(process.env.TRACKING_KEY_PEPPER || 'campusvoice-vault-key-default').digest();
}

/**
 * Encrypts a string (e.g. userId) using AES-256-GCM.
 * Output format: base64(iv + authTag + ciphertext)
 */
export function encryptUserId(userId: string): string {
  const key = getVaultKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(userId, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts an AES-256-GCM payload.
 */
export function decryptUserId(encryptedPayload: string): string {
  const key = getVaultKey();
  const combined = Buffer.from(encryptedPayload, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted vault payload length.');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
