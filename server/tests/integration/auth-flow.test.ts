import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/services/auth/passwords';
import { hashOTP, getOTPExpiry } from '../../src/services/auth/otp';
import { signToken } from '../../src/services/auth/tokens';
import { Role, UserStatus } from '@prisma/client';

describe('Auth & Onboarding Flow Integration (Phase 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('matches valid roster entry, creates PENDING user, and issues OTP', async () => {
      // Mock unique user check -> no existing user
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);

      // Mock roster entry found
      vi.spyOn(prisma.collegeRoster, 'findFirst').mockResolvedValue({
        id: 'roster-1',
        enrollmentNo: 'EN2026001',
        fullName: 'Aarav Sharma',
        collegeEmail: 'aarav.sharma@college.edu',
        role: Role.STUDENT,
        department: 'Computer Science',
        claimed: false,
        createdAt: new Date(),
      });

      // Mock user creation
      vi.spyOn(prisma.user, 'create').mockResolvedValue({
        id: 'user-uuid-1',
        username: 'aarav_sharma',
        passwordHash: 'hashed_pw',
        role: Role.STUDENT,
        collegeEmail: 'aarav.sharma@college.edu',
        rosterId: 'roster-1',
        status: UserStatus.PENDING_VERIFY,
        department: 'Computer Science',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock verification request creation
      vi.spyOn(prisma.verificationRequest, 'create').mockResolvedValue({
        id: 'verif-1',
        userId: 'user-uuid-1',
        method: 'ROSTER_OTP',
        otpHash: 'hashed_otp',
        otpExpires: getOTPExpiry(10),
        idCardFileKey: null,
        status: 'PENDING',
        reviewedBy: null,
        rejectionReason: null,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'aarav_sharma',
          password: 'SecurePassword123!',
          enrollmentNo: 'EN2026001',
          collegeEmail: 'aarav.sharma@college.edu',
        });

      expect(res.status).toBe(201);
      expect(res.body.method).toBe('ROSTER_OTP');
      expect(res.body.userId).toBe('user-uuid-1');
      expect(res.body.message).toContain('Verification OTP sent');
    });

    it('falls back to ID_CARD upload queue if roster entry does not match', async () => {
      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.collegeRoster, 'findFirst').mockResolvedValue(null);

      vi.spyOn(prisma.user, 'create').mockResolvedValue({
        id: 'user-uuid-2',
        username: 'unknown_student',
        passwordHash: 'hashed_pw',
        role: Role.STUDENT,
        collegeEmail: 'unknown@external.edu',
        rosterId: null,
        status: UserStatus.PENDING_VERIFY,
        department: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(prisma.verificationRequest, 'create').mockResolvedValue({
        id: 'verif-2',
        userId: 'user-uuid-2',
        method: 'ID_CARD',
        otpHash: null,
        otpExpires: null,
        idCardFileKey: null,
        status: 'PENDING',
        reviewedBy: null,
        rejectionReason: null,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'unknown_student',
          password: 'SecurePassword123!',
          enrollmentNo: 'EN9999999',
          collegeEmail: 'unknown@external.edu',
        });

      expect(res.status).toBe(201);
      expect(res.body.method).toBe('ID_CARD');
      expect(res.body.message).toContain('upload your student/faculty ID card');
    });

    it('rejects passwords shorter than 10 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'short_pw_user',
          password: 'short',
          enrollmentNo: 'EN2026001',
          collegeEmail: 'aarav.sharma@college.edu',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/verify/otp', () => {
    it('activates user and returns session token when OTP is valid', async () => {
      const plainOtp = '123456';
      const hashedOtp = hashOTP(plainOtp);

      vi.spyOn(prisma.verificationRequest, 'findFirst').mockResolvedValue({
        id: 'verif-1',
        userId: 'user-uuid-1',
        method: 'ROSTER_OTP',
        otpHash: hashedOtp,
        otpExpires: getOTPExpiry(10),
        idCardFileKey: null,
        status: 'PENDING',
        reviewedBy: null,
        rejectionReason: null,
        createdAt: new Date(),
      } as any);

      // Mock transaction
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          user: {
            update: vi.fn().mockResolvedValue({
              id: 'user-uuid-1',
              username: 'aarav_sharma',
              role: Role.STUDENT,
              status: UserStatus.ACTIVE,
              collegeEmail: 'aarav.sharma@college.edu',
              department: 'Computer Science',
              rosterId: 'roster-1',
            }),
          },
          collegeRoster: {
            update: vi.fn().mockResolvedValue({}),
          },
          verificationRequest: {
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/auth/verify/otp')
        .send({
          userId: 'user-uuid-1',
          otp: plainOtp,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.status).toBe(UserStatus.ACTIVE);
      expect(res.body.user.role).toBe(Role.STUDENT);
    });

    it('rejects incorrect OTP', async () => {
      const hashedOtp = hashOTP('123456');

      vi.spyOn(prisma.verificationRequest, 'findFirst').mockResolvedValue({
        id: 'verif-1',
        userId: 'user-uuid-1',
        method: 'ROSTER_OTP',
        otpHash: hashedOtp,
        otpExpires: getOTPExpiry(10),
        idCardFileKey: null,
        status: 'PENDING',
        reviewedBy: null,
        rejectionReason: null,
        createdAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/auth/verify/otp')
        .send({
          userId: 'user-uuid-1',
          otp: '000000',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OTP');
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates active user and returns token', async () => {
      const password = 'Password@1234';
      const passwordHash = await hashPassword(password);

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'user-uuid-active',
        username: 'active_student',
        passwordHash,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        collegeEmail: 'active@college.edu',
        rosterId: 'roster-1',
        department: 'Physics',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'active_student',
          password,
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('active_student');
    });

    it('blocks pending verification user with 403 PENDING_VERIFICATION', async () => {
      const password = 'Password@1234';
      const passwordHash = await hashPassword(password);

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'user-uuid-pending',
        username: 'pending_student',
        passwordHash,
        role: Role.STUDENT,
        status: UserStatus.PENDING_VERIFY,
        collegeEmail: 'pending@college.edu',
        rosterId: null,
        department: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'pending_student',
          password,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PENDING_VERIFICATION');
    });

    it('rejects incorrect password with 401', async () => {
      const passwordHash = await hashPassword('CorrectPassword@123');

      vi.spyOn(prisma.user, 'findFirst').mockResolvedValue({
        id: 'user-uuid',
        username: 'user1',
        passwordHash,
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        collegeEmail: 'user1@college.edu',
        rosterId: null,
        department: null,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'user1',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('Route-Level RBAC Enforcement (RBAC-2)', () => {
    it('denies STUDENT access to SUPER_ADMIN roster import with 403 FORBIDDEN', async () => {
      const studentToken = signToken({
        id: 'student-id',
        username: 'student_user',
        role: Role.STUDENT,
        status: 'ACTIVE',
        collegeEmail: 'student@college.edu',
      });

      const res = await request(app)
        .post('/api/admin/roster/import')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          roster: [
            {
              enrollmentNo: 'EN999',
              fullName: 'Test',
              collegeEmail: 'test@college.edu',
              role: Role.STUDENT,
              department: 'CS',
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows SUPER_ADMIN to import roster successfully', async () => {
      const superAdminToken = signToken({
        id: 'superadmin-id',
        username: 'superadmin',
        role: Role.SUPER_ADMIN,
        status: 'ACTIVE',
        collegeEmail: 'superadmin@campus.edu',
      });

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          collegeRoster: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/roster/import')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          roster: [
            {
              enrollmentNo: 'EN2026100',
              fullName: 'New Student',
              collegeEmail: 'new.student@college.edu',
              role: Role.STUDENT,
              department: 'Mechanical',
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
    });

    it('denies unauthenticated request to /api/auth/me with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns user session for valid authenticated /api/auth/me request', async () => {
      const token = signToken({
        id: 'user-123',
        username: 'test_user',
        role: Role.TEACHER,
        status: 'ACTIVE',
        collegeEmail: 'prof@college.edu',
        department: 'Physics',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('test_user');
      expect(res.body.user.role).toBe(Role.TEACHER);
    });
  });
});
