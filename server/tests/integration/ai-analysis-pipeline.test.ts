import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { signToken } from '../../src/services/auth/tokens';
import { Role, Priority, ComplaintStatus, AlertType, AlertStatus } from '@prisma/client';
import { analyzeComplaint } from '../../src/services/ai/analyze';

describe('AI Analysis Pipeline & Risk Alerts Integration (Phase 5)', () => {
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complaint Screening & Analysis Execution', () => {
    it('executes analysis pipeline, stores ai_analysis record, and updates complaint priority', async () => {
      const mockComplaint = {
        id: 'comp-101',
        title: 'Severe physical ragging in 3rd floor bathroom',
        description: 'Two first years were beaten and threatened with steel pipes by seniors.',
        priority: Priority.MEDIUM,
        status: ComplaintStatus.SUBMITTED,
        category: { id: 'cat-1', name: 'Anti-Ragging Squad', severityWeight: 5 },
        location: { id: 'loc-1', name: 'Hostel Block B' },
      };

      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue(mockComplaint as any);
      vi.spyOn(prisma.aiAnalysis, 'create').mockResolvedValue({ id: 'analysis-1' } as any);
      vi.spyOn(prisma.complaint, 'update').mockResolvedValue({ id: 'comp-101' } as any);
      vi.spyOn(prisma.riskAlert, 'create').mockResolvedValue({ id: 'alert-1' } as any);
      vi.spyOn(prisma.complaintEvent, 'create').mockResolvedValue({} as any);

      const result = await analyzeComplaint('comp-101');

      expect(result.aiAnalysisId).toBe('analysis-1');
      expect(result.suggestedCategory).toBeDefined();
      expect(result.priority).toBeDefined();
      expect(prisma.aiAnalysis.create).toHaveBeenCalled();
      expect(prisma.complaint.update).toHaveBeenCalled();
    });

    it('routes high spam probability complaints to FLAGGED_REVIEW status without auto-rejecting', async () => {
      const spamComplaint = {
        id: 'comp-spam-1',
        title: 'Earn crypto now bit.ly/freemoney',
        description: 'Join telegram whatsapp +9199999999 free bonus tokens daily.',
        priority: Priority.LOW,
        status: ComplaintStatus.SUBMITTED,
        category: { id: 'cat-2', name: 'Campus Infrastructure', severityWeight: 2 },
        location: { id: 'loc-2', name: 'Main Campus' },
      };

      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue(spamComplaint as any);
      vi.spyOn(prisma.aiAnalysis, 'create').mockResolvedValue({ id: 'analysis-spam' } as any);
      const updateSpy = vi.spyOn(prisma.complaint, 'update').mockResolvedValue({ id: 'comp-spam-1' } as any);
      vi.spyOn(prisma.complaintEvent, 'create').mockResolvedValue({} as any);

      const result = await analyzeComplaint('comp-spam-1');

      expect(result.isFlaggedForReview).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ComplaintStatus.FLAGGED_REVIEW,
          }),
        })
      );
    });
  });

  describe('Risk Alerts API (GET/PATCH /api/admin/alerts)', () => {
    it('allows administrators to list open risk alerts', async () => {
      vi.spyOn(prisma.riskAlert, 'findMany').mockResolvedValue([
        {
          id: 'alert-1',
          type: AlertType.CRITICAL,
          message: 'Active violent brawl reported outside cafeteria',
          status: AlertStatus.OPEN,
          createdAt: new Date(),
          complaint: { id: 'c-1', title: 'Brawl', priority: Priority.CRITICAL, status: 'SUBMITTED', pseudonym: 'P1' },
        } as any,
      ]);

      const res = await request(app)
        .get('/api/admin/alerts?status=OPEN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.alerts).toBeDefined();
      expect(res.body.alerts.length).toBe(1);
      expect(res.body.alerts[0].type).toBe(AlertType.CRITICAL);
    });

    it('allows administrators to acknowledge or resolve a risk alert', async () => {
      vi.spyOn(prisma.riskAlert, 'update').mockResolvedValue({
        id: 'alert-1',
        status: AlertStatus.ACK,
      } as any);

      const res = await request(app)
        .patch('/api/admin/alerts/alert-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACK' });

      expect(res.status).toBe(200);
      expect(res.body.alert.status).toBe('ACK');
    });
  });

  describe('Admin Analysis Override (POST /api/admin/cases/:id/override-analysis)', () => {
    it('allows administrator to manually override priority and records audit log', async () => {
      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'case-100',
        priority: Priority.MEDIUM,
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: { update: vi.fn().mockResolvedValue({}) },
          aiAnalysis: {
            findFirst: vi.fn().mockResolvedValue({ id: 'analysis-1' }),
            update: vi.fn().mockResolvedValue({}),
          },
          complaintEvent: { create: vi.fn().mockResolvedValue({}) },
        };
        return callback(tx);
      });

      const res = await request(app)
        .post('/api/admin/cases/case-100/override-analysis')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          priority: 'CRITICAL',
          reason: 'Security team escalated based on eyewitness testimony.',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('override applied');
    });
  });
});
