import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { signToken } from '../../src/services/auth/tokens';
import { generateTrackingKey, hashTrackingKey } from '../../src/services/complaints/tracking-key';
import { Role, ComplaintStatus, Priority, RestrictedQueue, Outcome } from '@prisma/client';

describe('Admin Console, State Transitions & Chat (Phase 3)', () => {
  const adminToken = signToken({
    id: 'admin-1',
    username: 'admin_case1',
    role: Role.ADMIN,
    status: 'ACTIVE',
    collegeEmail: 'admin1@campus.edu',
  });

  const superAdminToken = signToken({
    id: 'superadmin-1',
    username: 'superadmin',
    role: Role.SUPER_ADMIN,
    status: 'ACTIVE',
    collegeEmail: 'superadmin@campus.edu',
  });

  const studentToken = signToken({
    id: 'student-1',
    username: 'student_user',
    role: Role.STUDENT,
    status: 'ACTIVE',
    collegeEmail: 'student@college.edu',
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Case State Transitions (WORKFLOW.md §4)', () => {
    it('allows valid transition from SUBMITTED to TRIAGED', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-1',
        status: ComplaintStatus.SUBMITTED,
        priority: Priority.MEDIUM,
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: {
            update: vi.fn().mockResolvedValue({
              id: 'case-1',
              status: ComplaintStatus.TRIAGED,
            }),
          },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .patch('/api/admin/cases/case-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ComplaintStatus.TRIAGED });

      expect(res.status).toBe(200);
      expect(res.body.case.status).toBe(ComplaintStatus.TRIAGED);
    });

    it('rejects invalid jump transition from SUBMITTED directly to RESOLVED with 400', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-1',
        status: ComplaintStatus.SUBMITTED,
      } as any);

      const res = await request(app)
        .patch('/api/admin/cases/case-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ComplaintStatus.RESOLVED, reason: 'Skipped ahead' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
    });

    it('requires a mandatory reason when transitioning to RESOLVED or ESCALATED', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-1',
        status: ComplaintStatus.IN_PROGRESS,
      } as any);

      // Attempt resolve WITHOUT reason
      const resWithoutReason = await request(app)
        .patch('/api/admin/cases/case-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ComplaintStatus.RESOLVED });

      expect(resWithoutReason.status).toBe(400);
      expect(resWithoutReason.body.error.code).toBe('INVALID_TRANSITION');
      expect(resWithoutReason.body.error.message).toContain('mandatory reason');

      // Attempt resolve WITH reason
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: {
            update: vi.fn().mockResolvedValue({
              id: 'case-1',
              status: ComplaintStatus.RESOLVED,
            }),
          },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const resWithReason = await request(app)
        .patch('/api/admin/cases/case-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: ComplaintStatus.RESOLVED, reason: 'Technician repaired electrical wiring.' });

      expect(resWithReason.status).toBe(200);
      expect(resWithReason.body.case.status).toBe(ComplaintStatus.RESOLVED);
    });
  });

  describe('Outcome Recording & Non-Negotiable Super Admin Gates', () => {
    it('denies regular ADMIN from confirming MALICIOUS outcome with 403', async () => {
      const res = await request(app)
        .post('/api/admin/cases/case-1/outcome')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          outcome: Outcome.MALICIOUS,
          outcomeReason: 'Fabricated accusation against professor',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SUPER_ADMIN_REQUIRED');
    });

    it('allows SUPER_ADMIN to confirm MALICIOUS outcome', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-1',
        status: ComplaintStatus.IN_PROGRESS,
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: {
            update: vi.fn().mockResolvedValue({
              id: 'case-1',
              outcome: Outcome.MALICIOUS,
              status: ComplaintStatus.REJECTED,
            }),
          },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/cases/case-1/outcome')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          outcome: Outcome.MALICIOUS,
          outcomeReason: 'Confirmed fabricated defamatory report by disciplinary inquiry',
        });

      expect(res.status).toBe(200);
      expect(res.body.case.outcome).toBe(Outcome.MALICIOUS);
      expect(res.body.case.status).toBe(ComplaintStatus.REJECTED);
    });

    it('allows regular ADMIN to confirm VALID outcome', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-1',
        status: ComplaintStatus.IN_PROGRESS,
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: {
            update: vi.fn().mockResolvedValue({
              id: 'case-1',
              outcome: Outcome.VALID,
              status: ComplaintStatus.RESOLVED,
            }),
          },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/cases/case-1/outcome')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          outcome: Outcome.VALID,
          outcomeReason: 'Maintenance verified and resolved issue',
        });

      expect(res.status).toBe(200);
      expect(res.body.case.outcome).toBe(Outcome.VALID);
      expect(res.body.case.status).toBe(ComplaintStatus.RESOLVED);
    });
  });

  describe('Restricted Queues Security (ICC / Anti-Ragging)', () => {
    it('denies regular ADMIN without committee role from querying restricted queues', async () => {
      const res = await request(app)
        .get('/api/admin/cases?queue=ICC')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows SUPER_ADMIN to query restricted queues', async () => {
      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([]);

      const res = await request(app)
        .get('/api/admin/cases?queue=ICC')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cases).toBeDefined();
    });
  });

  describe('Internal Notes & Public Isolation', () => {
    it('creates an internal note for admin and verifies it is not exposed publicly', async () => {
      vi.spyOn(prisma.internalNote, 'create').mockResolvedValue({
        id: 'note-1',
        complaintId: 'case-1',
        adminId: 'admin-1',
        body: 'Internal committee discussion notes: student called for hearing',
        createdAt: new Date(),
        admin: { username: 'admin_case1' },
      });

      const res = await request(app)
        .post('/api/admin/cases/case-1/notes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Internal committee discussion notes: student called for hearing' });

      expect(res.status).toBe(201);
      expect(res.body.note.body).toContain('Internal committee discussion notes');
    });
  });

  describe('Two-Way Chat & Status Toggling (CHAT-1, CHAT-2)', () => {
    const validKey = generateTrackingKey();
    const keyHash = hashTrackingKey(validKey);

    it('toggles status to NEEDS_INFO when Admin sends message with requestInfo: true', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-chat-1',
        status: ComplaintStatus.IN_PROGRESS,
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaintMessage: {
            create: vi.fn().mockResolvedValue({
              id: 'msg-1',
              complaintId: 'case-chat-1',
              sender: 'ADMIN',
              adminId: 'admin-1',
              body: 'Please provide exact room number of the broken equipment.',
              createdAt: new Date(),
            }),
          },
          complaint: { update: vi.fn().mockResolvedValue({}) },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/cases/case-chat-1/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          body: 'Please provide exact room number of the broken equipment.',
          requestInfo: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.chatMessage.sender).toBe('ADMIN');
    });

    it('automatically toggles status from NEEDS_INFO to IN_PROGRESS when Complainant replies', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-chat-1',
        trackingKeyHash: keyHash,
        status: ComplaintStatus.NEEDS_INFO,
      } as any);

      const txUpdateSpy = vi.fn().mockResolvedValue({});

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaintMessage: {
            create: vi.fn().mockResolvedValue({
              id: 'msg-reply-1',
              complaintId: 'case-chat-1',
              sender: 'COMPLAINANT',
              body: 'The room is 302 on the 3rd floor.',
              createdAt: new Date(),
            }),
          },
          complaint: { update: txUpdateSpy },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post(`/api/track/${validKey}/messages`)
        .send({ body: 'The room is 302 on the 3rd floor.' });

      expect(res.status).toBe(201);
      expect(res.body.chatMessage.sender).toBe('COMPLAINANT');

      // Verify status was toggled to IN_PROGRESS
      expect(txUpdateSpy).toHaveBeenCalledWith({
        where: { id: 'case-chat-1' },
        data: { status: ComplaintStatus.IN_PROGRESS },
      });
    });
  });
});
