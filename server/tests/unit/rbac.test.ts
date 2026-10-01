import { describe, it, expect } from 'vitest';
import { Role } from '@prisma/client';
import { hasPermission, RBAC_MATRIX, Permission } from '../../src/services/auth/rbac';

describe('RBAC Matrix Enforcement (ARCHITECTURE.md §6)', () => {
  const allRoles: Role[] = [
    Role.STUDENT,
    Role.TEACHER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.SECURITY,
  ];

  const permissions: Permission[] = Object.keys(RBAC_MATRIX) as Permission[];

  it('verifies that each permission has an explicit allow-list (deny by default)', () => {
    for (const perm of permissions) {
      const allowedRoles = RBAC_MATRIX[perm];
      expect(allowedRoles).toBeDefined();
      expect(Array.isArray(allowedRoles)).toBe(true);

      for (const role of allRoles) {
        if (allowedRoles.includes(role)) {
          expect(hasPermission(role, perm)).toBe(true);
        } else {
          expect(hasPermission(role, perm)).toBe(false);
        }
      }
    }
  });

  describe('Role-Specific Capability Assertions', () => {
    it('STUDENT has accurate capabilities and cannot access admin/moderation', () => {
      // Allowed capabilities
      expect(hasPermission(Role.STUDENT, 'READ_RULES')).toBe(true);
      expect(hasPermission(Role.STUDENT, 'FILE_COMPLAINT')).toBe(true);
      expect(hasPermission(Role.STUDENT, 'VIEW_OWN_COMPLAINTS')).toBe(true);
      expect(hasPermission(Role.STUDENT, 'TRACK_BY_KEY')).toBe(true);
      expect(hasPermission(Role.STUDENT, 'CHAT_ON_OWN_COMPLAINT')).toBe(true);
      expect(hasPermission(Role.STUDENT, 'TRIGGER_SOS')).toBe(true);

      // Denied administrative capabilities
      expect(hasPermission(Role.STUDENT, 'EDIT_RULES')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'VIEW_ALL_COMPLAINTS')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'MANAGE_COMPLAINT')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'VIEW_RISK_ALERTS')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'MANAGE_ROSTER')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'APPROVE_ID_CARD')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'CONFIRM_MALICIOUS_OUTCOME')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'BREAK_GLASS_REVEAL')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'VIEW_AUDIT_LOGS')).toBe(false);
      expect(hasPermission(Role.STUDENT, 'MANAGE_SOS')).toBe(false);
    });

    it('TEACHER has same reporting capabilities as student and cannot access admin endpoints', () => {
      expect(hasPermission(Role.TEACHER, 'FILE_COMPLAINT')).toBe(true);
      expect(hasPermission(Role.TEACHER, 'VIEW_OWN_COMPLAINTS')).toBe(true);
      expect(hasPermission(Role.TEACHER, 'VIEW_ALL_COMPLAINTS')).toBe(false);
      expect(hasPermission(Role.TEACHER, 'MANAGE_ROSTER')).toBe(false);
    });

    it('ADMIN has complaint handling capabilities but restricted from super-admin controls', () => {
      // Allowed
      expect(hasPermission(Role.ADMIN, 'READ_RULES')).toBe(true);
      expect(hasPermission(Role.ADMIN, 'VIEW_ALL_COMPLAINTS')).toBe(true);
      expect(hasPermission(Role.ADMIN, 'MANAGE_COMPLAINT')).toBe(true);
      expect(hasPermission(Role.ADMIN, 'VIEW_RISK_ALERTS')).toBe(true);
      expect(hasPermission(Role.ADMIN, 'APPROVE_ID_CARD')).toBe(true);
      expect(hasPermission(Role.ADMIN, 'MANAGE_SOS')).toBe(true);

      // Denied (Super Admin exclusive)
      expect(hasPermission(Role.ADMIN, 'EDIT_RULES')).toBe(false);
      expect(hasPermission(Role.ADMIN, 'MANAGE_ROSTER')).toBe(false);
      expect(hasPermission(Role.ADMIN, 'CONFIRM_MALICIOUS_OUTCOME')).toBe(false);
      expect(hasPermission(Role.ADMIN, 'BREAK_GLASS_REVEAL')).toBe(false);
      expect(hasPermission(Role.ADMIN, 'VIEW_AUDIT_LOGS')).toBe(false);
      expect(hasPermission(Role.ADMIN, 'FILE_COMPLAINT')).toBe(false);
    });

    it('SUPER_ADMIN possesses full governance permissions', () => {
      expect(hasPermission(Role.SUPER_ADMIN, 'EDIT_RULES')).toBe(true);
      expect(hasPermission(Role.SUPER_ADMIN, 'MANAGE_ROSTER')).toBe(true);
      expect(hasPermission(Role.SUPER_ADMIN, 'CONFIRM_MALICIOUS_OUTCOME')).toBe(true);
      expect(hasPermission(Role.SUPER_ADMIN, 'BREAK_GLASS_REVEAL')).toBe(true);
      expect(hasPermission(Role.SUPER_ADMIN, 'VIEW_AUDIT_LOGS')).toBe(true);
      expect(hasPermission(Role.SUPER_ADMIN, 'VIEW_ALL_COMPLAINTS')).toBe(true);
    });

    it('SECURITY has access strictly limited to SOS management and rules', () => {
      expect(hasPermission(Role.SECURITY, 'READ_RULES')).toBe(true);
      expect(hasPermission(Role.SECURITY, 'TRIGGER_SOS')).toBe(true);
      expect(hasPermission(Role.SECURITY, 'MANAGE_SOS')).toBe(true);

      // Denied everything else
      expect(hasPermission(Role.SECURITY, 'VIEW_ALL_COMPLAINTS')).toBe(false);
      expect(hasPermission(Role.SECURITY, 'MANAGE_COMPLAINT')).toBe(false);
      expect(hasPermission(Role.SECURITY, 'MANAGE_ROSTER')).toBe(false);
      expect(hasPermission(Role.SECURITY, 'VIEW_AUDIT_LOGS')).toBe(false);
    });
  });
});
