import { Role } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

export type Permission =
  | 'READ_RULES'
  | 'EDIT_RULES'
  | 'FILE_COMPLAINT'
  | 'VIEW_OWN_COMPLAINTS'
  | 'TRACK_BY_KEY'
  | 'CHAT_ON_OWN_COMPLAINT'
  | 'VIEW_ALL_COMPLAINTS'
  | 'MANAGE_COMPLAINT'
  | 'VIEW_RISK_ALERTS'
  | 'MANAGE_ROSTER'
  | 'APPROVE_ID_CARD'
  | 'CONFIRM_MALICIOUS_OUTCOME'
  | 'BREAK_GLASS_REVEAL'
  | 'VIEW_AUDIT_LOGS'
  | 'TRIGGER_SOS'
  | 'MANAGE_SOS';

// Authoritative RBAC Matrix defined in ARCHITECTURE.md §6
export const RBAC_MATRIX: Record<Permission, Role[]> = {
  READ_RULES: [Role.STUDENT, Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN, Role.SECURITY],
  EDIT_RULES: [Role.SUPER_ADMIN],
  FILE_COMPLAINT: [Role.STUDENT, Role.TEACHER],
  VIEW_OWN_COMPLAINTS: [Role.STUDENT, Role.TEACHER],
  TRACK_BY_KEY: [Role.STUDENT, Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN],
  CHAT_ON_OWN_COMPLAINT: [Role.STUDENT, Role.TEACHER],
  VIEW_ALL_COMPLAINTS: [Role.ADMIN, Role.SUPER_ADMIN],
  MANAGE_COMPLAINT: [Role.ADMIN, Role.SUPER_ADMIN],
  VIEW_RISK_ALERTS: [Role.ADMIN, Role.SUPER_ADMIN],
  MANAGE_ROSTER: [Role.SUPER_ADMIN],
  APPROVE_ID_CARD: [Role.ADMIN, Role.SUPER_ADMIN],
  CONFIRM_MALICIOUS_OUTCOME: [Role.SUPER_ADMIN],
  BREAK_GLASS_REVEAL: [Role.SUPER_ADMIN],
  VIEW_AUDIT_LOGS: [Role.SUPER_ADMIN],
  TRIGGER_SOS: [Role.STUDENT, Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN, Role.SECURITY],
  MANAGE_SOS: [Role.ADMIN, Role.SUPER_ADMIN, Role.SECURITY],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = RBAC_MATRIX[permission];
  return allowedRoles ? allowedRoles.includes(role) : false;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: Role;
  status: string;
  collegeEmail: string;
  department?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Middleware: require one of the specified roles. Deny by default.
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to access this resource.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires one of: [${allowedRoles.join(', ')}].`,
        },
      });
    }

    next();
  };
}

/**
 * Middleware: require a specific capability/permission. Deny by default.
 */
export function requirePermission(permission: Permission) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to access this resource.',
        },
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Missing permission: ${permission}.`,
        },
      });
    }

    next();
  };
}
