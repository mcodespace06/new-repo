import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../services/auth/passwords';
import { generateOTP, hashOTP, verifyOTPHash, getOTPExpiry } from '../services/auth/otp';
import { signToken } from '../services/auth/tokens';
import { sendEmail } from '../services/notifications/mailer';
import { authenticate } from '../middleware/auth.middleware';
import { rateLimiter } from '../middleware/rate-limit';
import { AuthenticatedRequest } from '../services/auth/rbac';
import {
  RegisterSchema,
  VerifyOtpSchema,
  IdCardUploadSchema,
  LoginSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
} from '../lib/zod/auth';
import { UserStatus } from '@prisma/client';

const router = Router();

// Rate limiting on sensitive auth endpoints
const authLimiter = rateLimiter({ maxRequests: 10, windowMs: 60 * 1000, keyPrefix: 'auth' });
const otpLimiter = rateLimiter({ maxRequests: 5, windowMs: 60 * 1000, keyPrefix: 'otp' });

/**
 * POST /api/auth/register
 * Step 1 of onboarding: Validates roster or routes to ID card queue
 */
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const parseResult = RegisterSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
        details: parseResult.error.flatten(),
      },
    });
  }

  const { username, password, enrollmentNo, collegeEmail } = parseResult.data;

  // Check unique constraints
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { collegeEmail }],
    },
  });

  if (existingUser) {
    const field = existingUser.username === username ? 'Username' : 'College email';
    return res.status(409).json({
      error: {
        code: 'ALREADY_EXISTS',
        message: `${field} is already registered.`,
      },
    });
  }

  const passwordHash = await hashPassword(password);

  // Check College Roster match (AUTH-2)
  const rosterEntry = await prisma.collegeRoster.findFirst({
    where: {
      enrollmentNo,
      collegeEmail,
      claimed: false,
    },
  });

  if (rosterEntry) {
    // Roster matched! Create pending user and send OTP
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        collegeEmail,
        rosterId: rosterEntry.id,
        role: rosterEntry.role, // role assigned strictly from roster!
        status: UserStatus.PENDING_VERIFY,
        department: rosterEntry.department,
      },
    });

    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const otpExpires = getOTPExpiry(10);

    await prisma.verificationRequest.create({
      data: {
        userId: user.id,
        method: 'ROSTER_OTP',
        otpHash,
        otpExpires,
        status: 'PENDING',
      },
    });

    await sendEmail({
      to: collegeEmail,
      subject: 'CampusVoice Verification Code',
      text: `Your CampusVoice verification code is: ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
    });

    return res.status(201).json({
      message: 'Roster match verified. Verification OTP sent to your college email.',
      userId: user.id,
      method: 'ROSTER_OTP',
      // In non-production, return preview OTP for testing convenience
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
    });
  } else {
    // No roster match -> fallback to ID Card upload queue (AUTH-3)
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        collegeEmail,
        status: UserStatus.PENDING_VERIFY,
      },
    });

    await prisma.verificationRequest.create({
      data: {
        userId: user.id,
        method: 'ID_CARD',
        status: 'PENDING',
      },
    });

    return res.status(201).json({
      message: 'College ID not found in current roster. Please upload your student/faculty ID card for manual verification.',
      userId: user.id,
      method: 'ID_CARD',
    });
  }
});

/**
 * POST /api/auth/verify/otp
 * Validates 6-digit OTP and activates account
 */
router.post('/verify/otp', otpLimiter, async (req: Request, res: Response) => {
  const parseResult = VerifyOtpSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
      },
    });
  }

  const { userId, otp } = parseResult.data;

  const verification = await prisma.verificationRequest.findFirst({
    where: {
      userId,
      method: 'ROSTER_OTP',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
    include: { user: { include: { rosterEntry: true } } },
  });

  if (!verification || !verification.otpHash || !verification.otpExpires) {
    return res.status(400).json({
      error: {
        code: 'NO_PENDING_OTP',
        message: 'No pending OTP verification found for this account.',
      },
    });
  }

  if (new Date() > verification.otpExpires) {
    return res.status(400).json({
      error: {
        code: 'OTP_EXPIRED',
        message: 'The verification code has expired. Please request a new one.',
      },
    });
  }

  const isValid = verifyOTPHash(otp, verification.otpHash);
  if (!isValid) {
    return res.status(400).json({
      error: {
        code: 'INVALID_OTP',
        message: 'Incorrect verification code. Please check and try again.',
      },
    });
  }

  // OTP valid! Activate user and claim roster entry
  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
      },
    });

    if (user.rosterId) {
      await tx.collegeRoster.update({
        where: { id: user.rosterId },
        data: { claimed: true },
      });
    }

    await tx.verificationRequest.update({
      where: { id: verification.id },
      data: { status: 'APPROVED' },
    });

    return user;
  });

  const sessionUser = {
    id: updatedUser.id,
    username: updatedUser.username,
    role: updatedUser.role,
    status: updatedUser.status,
    collegeEmail: updatedUser.collegeEmail,
    department: updatedUser.department,
  };

  const token = signToken(sessionUser);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json({
    message: 'Account successfully verified and activated.',
    token,
    user: sessionUser,
  });
});

/**
 * POST /api/auth/verify/id-card
 * Fallback: Upload ID card proof
 */
router.post('/verify/id-card', async (req: Request, res: Response) => {
  const parseResult = IdCardUploadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
      },
    });
  }

  const { userId, idCardFileKey } = parseResult.data;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User account not found.',
      },
    });
  }

  await prisma.verificationRequest.create({
    data: {
      userId,
      method: 'ID_CARD',
      idCardFileKey,
      status: 'PENDING',
    },
  });

  return res.status(200).json({
    message: 'ID card uploaded. An administrator will review your application within 24 hours.',
    status: 'PENDING',
  });
});

/**
 * POST /api/auth/login
 * Rate-limited login with argon2id verification
 */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const parseResult = LoginSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
      },
    });
  }

  const { username, password } = parseResult.data;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { collegeEmail: username }],
    },
  });

  if (!user) {
    return res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
      },
    });
  }

  const passwordValid = await verifyPassword(user.passwordHash, password);
  if (!passwordValid) {
    return res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password.',
      },
    });
  }

  if (user.status === UserStatus.SUSPENDED) {
    return res.status(403).json({
      error: {
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended. Please contact campus administration.',
      },
    });
  }

  if (user.status === UserStatus.PENDING_VERIFY) {
    return res.status(403).json({
      error: {
        code: 'PENDING_VERIFICATION',
        message: 'Account verification is pending. Please verify your OTP or wait for ID card approval.',
        userId: user.id,
      },
    });
  }

  const sessionUser = {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    collegeEmail: user.collegeEmail,
    department: user.department,
  };

  const token = signToken(sessionUser);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json({
    message: 'Login successful.',
    token,
    user: sessionUser,
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  return res.status(200).json({ message: 'Logged out successfully.' });
});

/**
 * GET /api/auth/me
 * Returns current authenticated user profile
 */
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({ user: req.user });
});

/**
 * POST /api/auth/reset/request
 * Request password reset OTP
 */
router.post('/reset/request', authLimiter, async (req: Request, res: Response) => {
  const parseResult = PasswordResetRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
      },
    });
  }

  const { collegeEmail } = parseResult.data;
  const user = await prisma.user.findUnique({ where: { collegeEmail } });

  // For security, do not disclose whether email exists
  if (!user) {
    return res.status(200).json({
      message: 'If the email exists, a password reset code has been sent.',
    });
  }

  const otp = generateOTP();
  const otpHash = hashOTP(otp);
  const otpExpires = getOTPExpiry(15);

  await prisma.verificationRequest.create({
    data: {
      userId: user.id,
      method: 'PASSWORD_RESET',
      otpHash,
      otpExpires,
      status: 'PENDING',
    },
  });

  await sendEmail({
    to: collegeEmail,
    subject: 'CampusVoice Password Reset Code',
    text: `Your password reset code is: ${otp}. It expires in 15 minutes.`,
  });

  return res.status(200).json({
    message: 'If the email exists, a password reset code has been sent.',
    ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
  });
});

/**
 * POST /api/auth/reset/confirm
 * Reset password using OTP
 */
router.post('/reset/confirm', authLimiter, async (req: Request, res: Response) => {
  const parseResult = PasswordResetConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
      },
    });
  }

  const { collegeEmail, otp, newPassword } = parseResult.data;
  const user = await prisma.user.findUnique({ where: { collegeEmail } });

  if (!user) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid password reset request.',
      },
    });
  }

  const verification = await prisma.verificationRequest.findFirst({
    where: {
      userId: user.id,
      method: 'PASSWORD_RESET',
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!verification || !verification.otpHash || !verification.otpExpires) {
    return res.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'No pending reset request found.',
      },
    });
  }

  if (new Date() > verification.otpExpires) {
    return res.status(400).json({
      error: {
        code: 'EXPIRED_CODE',
        message: 'Password reset code has expired.',
      },
    });
  }

  if (!verifyOTPHash(otp, verification.otpHash)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_CODE',
        message: 'Incorrect password reset code.',
      },
    });
  }

  const newHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    }),
    prisma.verificationRequest.update({
      where: { id: verification.id },
      data: { status: 'USED' },
    }),
  ]);

  return res.status(200).json({ message: 'Password has been successfully reset. You may now login.' });
});

export default router;
