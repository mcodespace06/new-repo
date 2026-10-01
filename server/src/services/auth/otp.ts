import crypto from 'crypto';

const OTP_PEPPER = process.env.TRACKING_KEY_PEPPER || 'campusvoice-default-pepper';

export function generateOTP(): string {
  // Cryptographically secure 6-digit number
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

export function hashOTP(otp: string): string {
  return crypto.createHmac('sha256', OTP_PEPPER).update(otp).digest('hex');
}

export function verifyOTPHash(otp: string, storedHash: string): boolean {
  const computed = hashOTP(otp);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

export function getOTPExpiry(minutes = 10): DateTime {
  return new Date(Date.now() + minutes * 60 * 1000);
}
type DateTime = Date;
