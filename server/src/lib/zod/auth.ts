import { z } from 'zod';
import { Role } from '@prisma/client';

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain alphanumeric characters and underscores'),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters long as per security requirements'),
  enrollmentNo: z.string().min(1, 'College enrollment / ID number is required'),
  collegeEmail: z.string().email('Valid college email is required'),
});

export const VerifyOtpSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
});

export const IdCardUploadSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  idCardFileKey: z.string().min(1, 'ID card file key or photo is required'),
});

export const LoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const PasswordResetRequestSchema = z.object({
  collegeEmail: z.string().email('Valid college email is required'),
});

export const PasswordResetConfirmSchema = z.object({
  collegeEmail: z.string().email('Valid college email is required'),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  newPassword: z.string().min(10, 'New password must be at least 10 characters long'),
});

export const RosterItemSchema = z.object({
  enrollmentNo: z.string().min(1, 'Enrollment number is required'),
  fullName: z.string().min(1, 'Full name is required'),
  collegeEmail: z.string().email('Valid college email is required'),
  role: z.nativeEnum(Role, { errorMap: () => ({ message: 'Role must be STUDENT or TEACHER' }) }),
  department: z.string().min(1, 'Department is required'),
});

export const RosterImportSchema = z.object({
  roster: z.array(RosterItemSchema).min(1, 'At least one roster entry is required'),
});
