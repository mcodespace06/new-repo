import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from './rbac';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-campusvoice-2026';
const TOKEN_EXPIRY = '7d';

export function signToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      collegeEmail: user.collegeEmail,
      department: user.department,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    return decoded;
  } catch {
    return null;
  }
}
