import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole, AuthenticatedRequest } from '../services/auth/rbac';
import { RosterImportSchema } from '../lib/zod/auth';
import { UpdateCaseStatusSchema, InternalNoteSchema, RecordOutcomeSchema, SendMessageSchema } from '../lib/zod/admin';
import { validateStateTransition } from '../services/complaints/state-machine';
import { chatBus } from '../services/chat/bus';
import { Role, UserStatus, RestrictedQueue, ComplaintStatus, Outcome, Priority, AlertStatus } from '@prisma/client';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/admin/cases
 * Filterable case list with queue restriction guards (ADM-1, ADM-2)
 */
router.get(
  '/cases',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { status, priority, categoryId, locationId, queue, search } = req.query;

    const isSuperAdmin = req.user!.role === Role.SUPER_ADMIN;

    // Restricted queue security guard (ARCHITECTURE.md §6)
    let queueFilter: RestrictedQueue | undefined;
    if (queue && Object.values(RestrictedQueue).includes(queue as RestrictedQueue)) {
      if (queue !== RestrictedQueue.NONE && !isSuperAdmin) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: `Access to restricted queue '${queue}' requires committee membership or Super Admin authority.`,
          },
        });
      }
      queueFilter = queue as RestrictedQueue;
    } else if (!isSuperAdmin) {
      // Normal admins see standard non-restricted complaints by default
      queueFilter = RestrictedQueue.NONE;
    }

    const whereClause: any = {};
    if (queueFilter) whereClause.restrictedQueue = queueFilter;
    if (status) whereClause.status = status as ComplaintStatus;
    if (priority) whereClause.priority = priority;
    if (categoryId) whereClause.categoryId = categoryId as string;
    if (locationId) whereClause.locationId = locationId as string;
    if (search && typeof search === 'string') {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { pseudonym: { contains: search, mode: 'insensitive' } },
      ];
    }

    const cases = await prisma.complaint.findMany({
      where: whereClause,
      include: {
        category: { select: { id: true, name: true, routesToQueue: true } },
        location: { select: { id: true, name: true } },
        assignedAdmin: { select: { id: true, username: true } },
        _count: { select: { messages: true, notes: true, events: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Executive summary counters
    const counts = {
      total: cases.length,
      submitted: cases.filter((c) => c.status === ComplaintStatus.SUBMITTED).length,
      triaged: cases.filter((c) => c.status === ComplaintStatus.TRIAGED).length,
      inProgress: cases.filter((c) => c.status === ComplaintStatus.IN_PROGRESS).length,
      needsInfo: cases.filter((c) => c.status === ComplaintStatus.NEEDS_INFO).length,
      escalated: cases.filter((c) => c.status === ComplaintStatus.ESCALATED).length,
      resolved: cases.filter((c) => c.status === ComplaintStatus.RESOLVED).length,
    };

    return res.status(200).json({ cases, counts });
  }
);

/**
 * GET /api/admin/cases/:id
 * Detailed case view including notes and messages (ADM-3)
 */
router.get(
  '/cases/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const isSuperAdmin = req.user!.role === Role.SUPER_ADMIN;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        category: true,
        location: true,
        assignedAdmin: { select: { id: true, username: true, department: true } },
        attachments: true,
        notes: {
          include: { admin: { select: { username: true } } },
          orderBy: { createdAt: 'desc' },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        events: {
          orderBy: { createdAt: 'asc' },
        },
        aiAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        riskAlerts: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!complaint) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Complaint case not found.' },
      });
    }

    if (complaint.restrictedQueue !== RestrictedQueue.NONE && !isSuperAdmin) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Access to this restricted committee case is restricted.',
        },
      });
    }

    return res.status(200).json({ case: complaint });
  }
);

/**
 * PATCH /api/admin/cases/:id
 * State transitions, assignment, and priority adjustments with reason requirements (ADM-4)
 */
router.patch(
  '/cases/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const parseResult = UpdateCaseStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
        },
      });
    }

    const { status: targetStatus, reason, assignedTo, priority } = parseResult.data;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Case not found.' },
      });
    }

    // Validate state machine rules if status change is requested
    if (targetStatus && targetStatus !== complaint.status) {
      const validation = validateStateTransition(complaint.status, targetStatus, reason);
      if (!validation.valid) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TRANSITION',
            message: validation.error,
          },
        });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.complaint.update({
        where: { id },
        data: {
          ...(targetStatus && { status: targetStatus }),
          ...(assignedTo !== undefined && { assignedTo }),
          ...(priority && { priority }),
          ...(targetStatus === ComplaintStatus.RESOLVED && { resolvedAt: new Date() }),
        },
      });

      // Record timeline event
      if (targetStatus && targetStatus !== complaint.status) {
        await tx.complaintEvent.create({
          data: {
            complaintId: id,
            type: 'STATUS_CHANGE',
            actorRole: req.user!.role,
            payload: {
              from: complaint.status,
              to: targetStatus,
              reason: reason || null,
            },
          },
        });
      }

      if (assignedTo && assignedTo !== complaint.assignedTo) {
        await tx.complaintEvent.create({
          data: {
            complaintId: id,
            type: 'ASSIGNED',
            actorRole: req.user!.role,
            payload: { assignedTo },
          },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: 'CASE_UPDATED',
          entity: 'complaints',
          entityId: id,
          meta: { targetStatus, assignedTo, priority, reason },
        },
      });

      return c;
    });

    // Real-time broadcast
    chatBus.broadcast(id, 'status_change', {
      complaintId: id,
      status: updated.status,
      reason,
      actorRole: req.user!.role,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      message: 'Case status updated successfully.',
      case: updated,
    });
  }
);

/**
 * POST /api/admin/cases/:id/notes
 * Internal staff notes (NEVER visible to complainant)
 */
router.post(
  '/cases/:id/notes',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const parseResult = InternalNoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { body } = parseResult.data;

    const note = await prisma.internalNote.create({
      data: {
        complaintId: id,
        adminId: req.user!.id,
        body,
      },
      include: {
        admin: { select: { username: true } },
      },
    });

    return res.status(201).json({ message: 'Internal note saved.', note });
  }
);

/**
 * POST /api/admin/cases/:id/outcome
 * Outcome recording with Super Admin gate for MALICIOUS (WORKFLOW.md §6)
 */
router.post(
  '/cases/:id/outcome',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const parseResult = RecordOutcomeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { outcome, outcomeReason } = parseResult.data;

    // NON-NEGOTIABLE RULE 2: MALICIOUS outcome strictly requires Super Admin authority
    if (outcome === Outcome.MALICIOUS && req.user!.role !== Role.SUPER_ADMIN) {
      return res.status(403).json({
        error: {
          code: 'SUPER_ADMIN_REQUIRED',
          message: "Confirmation of a 'MALICIOUS' outcome strictly requires Super Admin authorization.",
        },
      });
    }

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Case not found.' },
      });
    }

    const finalStatus =
      outcome === Outcome.SPAM || outcome === Outcome.MALICIOUS
        ? ComplaintStatus.REJECTED
        : ComplaintStatus.RESOLVED;

    const updated = await prisma.$transaction(async (tx) => {
      const c = await tx.complaint.update({
        where: { id },
        data: {
          outcome,
          outcomeReason,
          status: finalStatus,
          resolvedAt: new Date(),
        },
      });

      await tx.complaintEvent.create({
        data: {
          complaintId: id,
          type: 'OUTCOME_RECORDED',
          actorRole: req.user!.role,
          payload: { outcome, outcomeReason, finalStatus },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: 'OUTCOME_RECORDED',
          entity: 'complaints',
          entityId: id,
          meta: { outcome, outcomeReason, finalStatus },
        },
      });

      return c;
    });

    chatBus.broadcast(id, 'outcome_recorded', {
      complaintId: id,
      outcome,
      status: finalStatus,
    });

    return res.status(200).json({
      message: `Case outcome recorded as ${outcome}.`,
      case: updated,
    });
  }
);

/**
 * GET /api/admin/cases/:id/messages
 * Retrieves chat message history
 */
router.get(
  '/cases/:id/messages',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const messages = await prisma.complaintMessage.findMany({
      where: { complaintId: id },
      orderBy: { createdAt: 'asc' },
    });

    return res.status(200).json({ messages });
  }
);

/**
 * POST /api/admin/cases/:id/messages
 * Admin sends reply in complaint thread (CHAT-1, CHAT-2)
 */
router.post(
  '/cases/:id/messages',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const parseResult = SendMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { body, requestInfo } = parseResult.data;

    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Case not found.' },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const message = await tx.complaintMessage.create({
        data: {
          complaintId: id,
          sender: 'ADMIN',
          adminId: req.user!.id,
          body,
        },
      });

      // If admin requests more info -> automatically toggle status to NEEDS_INFO (CHAT-2)
      if (requestInfo && complaint.status !== ComplaintStatus.NEEDS_INFO) {
        await tx.complaint.update({
          where: { id },
          data: { status: ComplaintStatus.NEEDS_INFO },
        });

        await tx.complaintEvent.create({
          data: {
            complaintId: id,
            type: 'STATUS_CHANGE',
            actorRole: req.user!.role,
            payload: {
              from: complaint.status,
              to: ComplaintStatus.NEEDS_INFO,
              reason: 'Admin requested additional clarification via chat.',
            },
          },
        });
      }

      return message;
    });

    // Real-time broadcast to SSE clients
    chatBus.broadcast(id, 'message', {
      id: result.id,
      complaintId: id,
      sender: 'ADMIN',
      body: result.body,
      createdAt: result.createdAt,
    });

    return res.status(201).json({
      message: 'Message sent to complainant.',
      chatMessage: result,
    });
  }
);

/**
 * GET /api/admin/cases/:id/messages/stream
 * Real-time SSE stream for Admin Case Console
 */
router.get(
  '/cases/:id/messages/stream',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    chatBus.registerClient(id, res);
  }
);

// Roster & Verification endpoints from Phase 1
router.post(
  '/roster/import',
  authenticate,
  requireRole([Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = RosterImportSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.errors[0].message,
          details: parseResult.error.flatten(),
        },
      });
    }

    const { roster } = parseResult.data;
    let importedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of roster) {
        await tx.collegeRoster.upsert({
          where: { enrollmentNo: item.enrollmentNo },
          update: {
            fullName: item.fullName,
            collegeEmail: item.collegeEmail,
            role: item.role,
            department: item.department,
          },
          create: {
            enrollmentNo: item.enrollmentNo,
            fullName: item.fullName,
            collegeEmail: item.collegeEmail,
            role: item.role,
            department: item.department,
            claimed: false,
          },
        });
        importedCount++;
      }

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: 'ROSTER_IMPORT',
          entity: 'college_roster',
          entityId: 'bulk',
          meta: { count: importedCount },
        },
      });
    });

    return res.status(200).json({
      message: `Successfully processed ${importedCount} roster identities.`,
      count: importedCount,
    });
  }
);

router.get(
  '/verifications',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const status = (req.query.status as string) || 'PENDING';

    const requests = await prisma.verificationRequest.findMany({
      where: { method: 'ID_CARD', status },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            collegeEmail: true,
            status: true,
            department: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ verifications: requests });
  }
);

const VerificationDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  assignedRole: z.nativeEnum(Role).optional(),
  department: z.string().optional(),
  reason: z.string().optional(),
});

router.patch(
  '/verifications/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const parseResult = VerificationDecisionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { action, assignedRole = Role.STUDENT, department, reason } = parseResult.data;

    const verification = await prisma.verificationRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!verification || verification.status !== 'PENDING') {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Verification request not found or already decided.' },
      });
    }

    await prisma.$transaction(async (tx) => {
      if (action === 'APPROVE') {
        await tx.user.update({
          where: { id: verification.userId },
          data: {
            status: UserStatus.ACTIVE,
            role: assignedRole,
            department: department || verification.user.department,
          },
        });

        await tx.verificationRequest.update({
          where: { id },
          data: { status: 'APPROVED', reviewedBy: req.user!.id },
        });
      } else {
        await tx.verificationRequest.update({
          where: { id },
          data: {
            status: 'REJECTED',
            reviewedBy: req.user!.id,
            rejectionReason: reason || 'ID document rejected by administrator.',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: req.user!.id,
          action: action === 'APPROVE' ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
          entity: 'verification_requests',
          entityId: id,
          meta: { targetUserId: verification.userId, action, assignedRole, reason },
        },
      });
    });

    return res.status(200).json({
      message: `Verification request ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully.`,
      status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    });
  }
);

/**
 * GET /api/admin/alerts
 * List risk alerts (CRITICAL, PATTERN, RECURRENCE, SLA_BREACH) (ADM-4)
 */
router.get(
  '/alerts',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status = 'OPEN' } = req.query;
      const where: any = {};
      if (status !== 'ALL') {
        where.status = status as AlertStatus;
      }

      const alerts = await prisma.riskAlert.findMany({
        where,
        include: {
          complaint: {
            select: { id: true, title: true, priority: true, status: true, pseudonym: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({ alerts });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
    }
  }
);

/**
 * PATCH /api/admin/alerts/:id
 * Acknowledge or resolve risk alert
 */
router.patch(
  '/alerts/:id',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const alert = await prisma.riskAlert.update({
        where: { id },
        data: { status },
      });

      return res.status(200).json({ alert });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
    }
  }
);

/**
 * POST /api/admin/cases/:id/override-analysis
 * Admin manual override of AI-suggested category or priority
 */
router.post(
  '/cases/:id/override-analysis',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { priority, categoryId, reason } = req.body;

      const complaint = await prisma.complaint.findUnique({ where: { id } });
      if (!complaint) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Case not found.' } });
      }

      await prisma.$transaction(async (tx) => {
        if (priority) {
          await tx.complaint.update({
            where: { id },
            data: { priority },
          });
        }
        if (categoryId) {
          await tx.complaint.update({
            where: { id },
            data: { categoryId },
          });
        }

        const latestAnalysis = await tx.aiAnalysis.findFirst({
          where: { complaintId: id },
          orderBy: { createdAt: 'desc' },
        });

        if (latestAnalysis) {
          await tx.aiAnalysis.update({
            where: { id: latestAnalysis.id },
            data: { overriddenBy: req.user!.username },
          });
        }

        await tx.complaintEvent.create({
          data: {
            complaintId: id,
            type: 'ANALYSIS_OVERRIDDEN',
            actorRole: req.user!.role,
            payload: { priority, categoryId, reason, admin: req.user!.username },
          },
        });
      });

      return res.status(200).json({ message: 'Analysis override applied successfully.' });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
    }
  }
);

export default router;
