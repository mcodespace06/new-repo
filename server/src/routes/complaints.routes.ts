import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { vaultService } from '../services/vault';
import { generateTrackingKey, verifyTrackingKey, hashTrackingKey } from '../services/complaints/tracking-key';
import { CreateComplaintSchema, TrackingKeyParamSchema } from '../lib/zod/complaint';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireRole, AuthenticatedRequest } from '../services/auth/rbac';
import { ComplaintMode, Role, RestrictedQueue, ComplaintStatus } from '@prisma/client';
import { analyzeComplaint } from '../services/ai/analyze';

const router = Router();

/**
 * GET /api/categories
 * Returns active complaint categories
 */
router.get('/categories', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });
  return res.status(200).json({ categories });
});

/**
 * GET /api/locations
 * Returns active campus locations
 */
router.get('/locations', async (_req: Request, res: Response) => {
  const locations = await prisma.location.findMany({
    orderBy: { name: 'asc' },
  });
  return res.status(200).json({ locations });
});

/**
 * POST /api/complaints
 * Complaint intake endpoint (CMP-1, CMP-2, CMP-3)
 * Non-Negotiable Rule 1: complaints table has NO user_id column.
 */
router.post('/', optionalAuthenticate, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = CreateComplaintSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
        details: parseResult.error.flatten(),
      },
    });
  }

  const {
    title,
    description,
    categoryId,
    locationId,
    incidentAt,
    mode,
    targetEntityType,
    targetEntityLabel,
    attachments,
  } = parseResult.data;

  // Confidential mode requires verified authentication
  if (mode === ComplaintMode.CONFIDENTIAL && !req.user) {
    return res.status(401).json({
      error: {
        code: 'AUTH_REQUIRED_FOR_CONFIDENTIAL',
        message: 'You must be signed in to submit a Confidential report. Alternatively, choose Ultra-Anonymous mode to file without signing in.',
      },
    });
  }

  // 1. Verify Category & determine queue
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return res.status(400).json({
      error: { code: 'INVALID_CATEGORY', message: 'Selected category does not exist.' },
    });
  }

  // 2. Generate Tracking Key & Pseudonym
  const trackingKey = generateTrackingKey();
  const trackingKeyHash = hashTrackingKey(trackingKey);
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
  const pseudonym = `Complainant #${randomHex}`;

  // 3. Handle optional target entity
  let targetEntityId: string | undefined;
  if (targetEntityType && targetEntityLabel) {
    const entity = await prisma.targetEntity.upsert({
      where: { label: targetEntityLabel },
      update: {},
      create: {
        type: targetEntityType,
        label: targetEntityLabel,
      },
    });
    targetEntityId = entity.id;
  }

  // 4. Create Complaint row in public schema (STRICT: ZERO user_id in this query!)
  const complaint = await prisma.$transaction(async (tx) => {
    const c = await tx.complaint.create({
      data: {
        trackingKeyHash,
        categoryId,
        title,
        description,
        locationId,
        incidentAt,
        mode,
        pseudonym,
        restrictedQueue: category.routesToQueue,
        targetEntityId,
      },
    });

    // Record initial event on timeline
    await tx.complaintEvent.create({
      data: {
        complaintId: c.id,
        type: 'SUBMITTED',
        actorRole: req.user?.role || Role.STUDENT,
        payload: {
          mode,
          categoryName: category.name,
        },
      },
    });

    // Attachments
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        await tx.attachment.create({
          data: {
            complaintId: c.id,
            fileKey: att.fileKey,
            mime: att.mime,
            size: att.size,
            sanitized: true,
          },
        });
      }
    }

    return c;
  });

  // 5. Vault Registration (Confidential mode ONLY)
  if (mode === ComplaintMode.CONFIDENTIAL && req.user) {
    await vaultService.linkReporter(complaint.id, req.user.id);
  }
  // When mode === ULTRA_ANON: Zero records written to vault!

  // 6. Trigger AI Complaint Screening & Analysis Pipeline (Job: analyze-complaint)
  try {
    await analyzeComplaint(complaint.id);
  } catch (err) {
    console.error('[AI Analysis Warning]:', err);
  }

  return res.status(201).json({
    message: 'Complaint filed successfully. Save your tracking key now — it cannot be recovered if lost.',
    complaintId: complaint.id,
    trackingKey, // RETURNED EXACTLY ONCE
    pseudonym,
    mode: complaint.mode,
  });
});

/**
 * GET /api/track/:key
 * Public track endpoint (TRK-1)
 */
router.get('/track/:key', async (req: Request, res: Response) => {
  const { key } = req.params;

  if (!verifyTrackingKey(key)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_TRACKING_KEY',
        message: 'The tracking key format or checksum is invalid. Format: CV-YYMM-XXXX-XXXX.',
      },
    });
  }

  const trackingKeyHash = hashTrackingKey(key);

  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      pseudonym: true,
      incidentAt: true,
      mode: true,
      createdAt: true,
      resolvedAt: true,
      category: {
        select: { id: true, name: true },
      },
      location: {
        select: { id: true, name: true },
      },
      attachments: {
        select: { id: true, fileKey: true, mime: true, size: true },
      },
    },
  });

  if (!complaint) {
    return res.status(404).json({
      error: {
        code: 'COMPLAINT_NOT_FOUND',
        message: 'No complaint found matching this tracking key.',
      },
    });
  }

  return res.status(200).json({ complaint });
});

/**
 * GET /api/track/:key/events
 * Public timeline of complaint events (TRK-2)
 */
router.get('/track/:key/events', async (req: Request, res: Response) => {
  const { key } = req.params;

  if (!verifyTrackingKey(key)) {
    return res.status(400).json({
      error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' },
    });
  }

  const trackingKeyHash = hashTrackingKey(key);

  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    select: { id: true },
  });

  if (!complaint) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
    });
  }

  const events = await prisma.complaintEvent.findMany({
    where: { complaintId: complaint.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      actorRole: true,
      payload: true,
      createdAt: true,
    },
  });

  return res.status(200).json({ events });
});

/**
 * GET /api/complaints/mine
 * Authenticated user's confidential complaints list
 */
router.get(
  '/mine',
  authenticate,
  requireRole([Role.STUDENT, Role.TEACHER]),
  async (req: AuthenticatedRequest, res: Response) => {
    const complaintIds = await vaultService.listComplaintsForUser(req.user!.id);

    if (complaintIds.length === 0) {
      return res.status(200).json({ complaints: [] });
    }

    const complaints = await prisma.complaint.findMany({
      where: {
        id: { in: complaintIds },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        pseudonym: true,
        incidentAt: true,
        createdAt: true,
        resolvedAt: true,
        category: { select: { name: true } },
        location: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ complaints });
  }
);

import { chatBus } from '../services/chat/bus';
import { SendMessageSchema } from '../lib/zod/admin';

/**
 * GET /api/track/:key/messages
 * Retrieves message thread for complainant (CHAT-1)
 */
router.get('/track/:key/messages', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const trackingKeyHash = hashTrackingKey(key);
  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    select: { id: true },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  const messages = await prisma.complaintMessage.findMany({
    where: { complaintId: complaint.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      sender: true,
      body: true,
      createdAt: true,
    },
  });

  return res.status(200).json({ messages });
});

/**
 * POST /api/track/:key/messages
 * Complainant sends a response; auto-toggles NEEDS_INFO -> IN_PROGRESS (CHAT-1, CHAT-2)
 */
router.post('/track/:key/messages', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const parseResult = SendMessageSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message } });
  }

  const { body } = parseResult.data;
  const trackingKeyHash = hashTrackingKey(key);

  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  const result = await prisma.$transaction(async (tx) => {
    const msg = await tx.complaintMessage.create({
      data: {
        complaintId: complaint.id,
        sender: 'COMPLAINANT',
        body,
      },
    });

    // WORKFLOW.md §5: Status auto-toggles NEEDS_INFO -> IN_PROGRESS when complainant replies
    if (complaint.status === ComplaintStatus.NEEDS_INFO) {
      await tx.complaint.update({
        where: { id: complaint.id },
        data: { status: ComplaintStatus.IN_PROGRESS },
      });

      await tx.complaintEvent.create({
        data: {
          complaintId: complaint.id,
          type: 'STATUS_CHANGE',
          actorRole: Role.STUDENT,
          payload: {
            from: ComplaintStatus.NEEDS_INFO,
            to: ComplaintStatus.IN_PROGRESS,
            reason: 'Complainant submitted requested information via chat.',
          },
        },
      });
    }

    return msg;
  });

  chatBus.broadcast(complaint.id, 'message', {
    id: result.id,
    complaintId: complaint.id,
    sender: 'COMPLAINANT',
    body: result.body,
    createdAt: result.createdAt,
  });

  return res.status(201).json({
    message: 'Message sent to administration.',
    chatMessage: {
      id: result.id,
      sender: result.sender,
      body: result.body,
      createdAt: result.createdAt,
    },
  });
});

/**
 * GET /api/track/:key/messages/stream
 * Real-time SSE stream for Complainant Tracking page (CHAT-5)
 */
router.get('/track/:key/messages/stream', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!verifyTrackingKey(key)) {
    return res.status(400).json({ error: { code: 'INVALID_TRACKING_KEY', message: 'Invalid tracking key.' } });
  }

  const trackingKeyHash = hashTrackingKey(key);
  const complaint = await prisma.complaint.findUnique({
    where: { trackingKeyHash },
    select: { id: true },
  });

  if (!complaint) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Complaint not found.' } });
  }

  chatBus.registerClient(complaint.id, res);
});

export default router;
