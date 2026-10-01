import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { vaultService } from '../../src/services/vault';
import { generateTrackingKey, hashTrackingKey } from '../../src/services/complaints/tracking-key';
import { signToken } from '../../src/services/auth/tokens';
import { ComplaintMode, Role, RestrictedQueue, Priority, ComplaintStatus, Prisma } from '@prisma/client';

describe('Complaints Core, Vault & Tracking (Phase 2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('NON-NEGOTIABLE ANONYMITY RULE: Schema-level check', () => {
    it('verifies that Complaint model has NO userId or user relation linking to the reporter', () => {
      const complaintModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'Complaint');
      expect(complaintModel).toBeDefined();

      const fieldNames = complaintModel!.fields.map((f) => f.name);

      // Must NOT contain user_id or reporter user relation
      expect(fieldNames).not.toContain('userId');
      expect(fieldNames).not.toContain('user_id');
      expect(fieldNames).not.toContain('reporterId');
      expect(fieldNames).not.toContain('reporter');
      expect(fieldNames).not.toContain('user');

      // Only assignedTo admin handler is permitted
      expect(fieldNames).toContain('assignedTo');
    });
  });

  describe('POST /api/complaints', () => {
    const studentUser = {
      id: 'student-uuid-42',
      username: 'anon_student',
      role: Role.STUDENT,
      status: 'ACTIVE',
      collegeEmail: 'student@college.edu',
    };
    const studentToken = signToken(studentUser);

    it('submits CONFIDENTIAL complaint, links reporter in Vault, and returns tracking key', async () => {
      // Mock category lookup
      vi.spyOn(prisma.category, 'findUnique').mockResolvedValue({
        id: 'cat-harassment-1',
        name: 'Harassment',
        severityWeight: 40,
        routesToQueue: RestrictedQueue.ICC,
        isSafety: true,
      });

      // Mock complaint creation in transaction
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: {
            create: vi.fn().mockResolvedValue({
              id: 'complaint-uuid-1',
              trackingKeyHash: 'some_hash',
              categoryId: 'cat-harassment-1',
              title: 'Harassment incident near library',
              description: 'Detailed description of the incident exceeding minimum characters requirement.',
              locationId: 'loc-1',
              incidentAt: new Date(),
              mode: ComplaintMode.CONFIDENTIAL,
              status: ComplaintStatus.SUBMITTED,
              priority: Priority.HIGH,
              pseudonym: 'Complainant #A1B2',
              restrictedQueue: RestrictedQueue.ICC,
              targetEntityId: null,
            }),
          },
          complaintEvent: {
            create: vi.fn().mockResolvedValue({}),
          },
          attachment: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const vaultLinkSpy = vi.spyOn(vaultService, 'linkReporter').mockResolvedValue();

      const res = await request(app)
        .post('/api/complaints')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Harassment incident near library',
          description: 'Detailed description of the incident exceeding minimum characters requirement.',
          categoryId: 'cat-harassment-1',
          locationId: 'loc-1',
          incidentAt: new Date().toISOString(),
          mode: ComplaintMode.CONFIDENTIAL,
        });

      expect(res.status).toBe(201);
      expect(res.body.complaintId).toBe('complaint-uuid-1');
      expect(res.body.trackingKey).toMatch(/^CV-\d{4}-[0-9A-HJKMNP-Z]{4}-[0-9A-HJKMNP-Z]{4}$/);
      expect(res.body.pseudonym).toBeDefined();
      expect(res.body.mode).toBe('CONFIDENTIAL');

      // Vault MUST be called with encrypted reporter linkage
      expect(vaultLinkSpy).toHaveBeenCalledWith('complaint-uuid-1', studentUser.id);
    });

    it('submits ULTRA_ANONYMOUS complaint: ZERO vault records created', async () => {
      vi.spyOn(prisma.category, 'findUnique').mockResolvedValue({
        id: 'cat-infra-1',
        name: 'Infrastructure',
        severityWeight: 10,
        routesToQueue: RestrictedQueue.NONE,
        isSafety: false,
      });

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          complaint: {
            create: vi.fn().mockResolvedValue({
              id: 'complaint-uuid-ultra',
              trackingKeyHash: 'some_hash',
              categoryId: 'cat-infra-1',
              title: 'Water leakage in hostel 3',
              description: 'Detailed description of water leakage issue on 2nd floor.',
              locationId: 'loc-2',
              incidentAt: new Date(),
              mode: ComplaintMode.ULTRA_ANON,
              status: ComplaintStatus.SUBMITTED,
              priority: Priority.MEDIUM,
              pseudonym: 'Complainant #F9E0',
              restrictedQueue: RestrictedQueue.NONE,
              targetEntityId: null,
            }),
          },
          complaintEvent: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const vaultLinkSpy = vi.spyOn(vaultService, 'linkReporter').mockResolvedValue();

      // Can submit without auth or with auth
      const res = await request(app)
        .post('/api/complaints')
        .send({
          title: 'Water leakage in hostel 3',
          description: 'Detailed description of water leakage issue on 2nd floor.',
          categoryId: 'cat-infra-1',
          locationId: 'loc-2',
          incidentAt: new Date().toISOString(),
          mode: ComplaintMode.ULTRA_ANON,
        });

      expect(res.status).toBe(201);
      expect(res.body.trackingKey).toBeDefined();
      expect(res.body.mode).toBe('ULTRA_ANON');

      // STRICT: Vault linkage MUST NEVER be called for Ultra-Anonymous
      expect(vaultLinkSpy).not.toHaveBeenCalled();
    });

    it('rejects confidential complaint submission if unauthenticated', async () => {
      const res = await request(app)
        .post('/api/complaints')
        .send({
          title: 'Unauthenticated confidential test',
          description: 'Detailed description exceeding character requirements here.',
          categoryId: 'cat-1',
          locationId: 'loc-1',
          incidentAt: new Date().toISOString(),
          mode: ComplaintMode.CONFIDENTIAL,
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_REQUIRED_FOR_CONFIDENTIAL');
    });
  });

  describe('GET /api/track/:key', () => {
    it('returns case details and timeline for a valid tracking key', async () => {
      const validKey = generateTrackingKey();
      const keyHash = hashTrackingKey(validKey);

      vi.spyOn(prisma.complaint, 'findUnique').mockResolvedValue({
        id: 'complaint-1',
        title: 'Broken electrical wiring',
        description: 'Wires are sparking near science lab block.',
        status: ComplaintStatus.IN_PROGRESS,
        priority: Priority.HIGH,
        pseudonym: 'Complainant #C3D4',
        incidentAt: new Date(),
        mode: ComplaintMode.CONFIDENTIAL,
        createdAt: new Date(),
        resolvedAt: null,
        category: { id: 'cat-1', name: 'Infrastructure' },
        location: { id: 'loc-1', name: 'Science Block' },
        attachments: [],
      } as any);

      const res = await request(app).get(`/api/track/${validKey}`);

      expect(res.status).toBe(200);
      expect(res.body.complaint).toBeDefined();
      expect(res.body.complaint.pseudonym).toBe('Complainant #C3D4');
      expect(res.body.complaint.status).toBe(ComplaintStatus.IN_PROGRESS);
      expect(res.body.complaint.category.name).toBe('Infrastructure');

      // Ensure NO user identifiers are in response
      expect(res.body.complaint.userId).toBeUndefined();
      expect(res.body.complaint.user).toBeUndefined();
    });

    it('rejects malformed or invalid tracking keys with 400', async () => {
      const res = await request(app).get('/api/track/INVALID-KEY-1234');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TRACKING_KEY');
    });
  });

  describe('GET /api/complaints/mine', () => {
    it('retrieves user complaints via vault mapping', async () => {
      const studentToken = signToken({
        id: 'student-uuid-99',
        username: 'active_student',
        role: Role.STUDENT,
        status: 'ACTIVE',
        collegeEmail: 'student99@college.edu',
      });

      vi.spyOn(vaultService, 'listComplaintsForUser').mockResolvedValue(['complaint-1', 'complaint-2']);

      vi.spyOn(prisma.complaint, 'findMany').mockResolvedValue([
        {
          id: 'complaint-1',
          title: 'Hostel cleanliness issue',
          status: ComplaintStatus.SUBMITTED,
          priority: Priority.MEDIUM,
          pseudonym: 'Complainant #77A1',
          incidentAt: new Date(),
          createdAt: new Date(),
          resolvedAt: null,
          category: { name: 'Hostel' },
          location: { name: 'North Hostel' },
        },
      ] as any);

      const res = await request(app)
        .get('/api/complaints/mine')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.complaints).toHaveLength(1);
      expect(res.body.complaints[0].title).toBe('Hostel cleanliness issue');
    });
  });
});
