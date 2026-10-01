import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireRole, AuthenticatedRequest } from '../services/auth/rbac';
import { Role, SosStatus } from '@prisma/client';
import { dispatchSosAlert } from '../services/sos/dispatch';
import { sosBus } from '../services/sos/bus';
import { findNearestPoliceStations } from '../services/sos/haversine';

export const sosRouter = Router();
export const securityRouter = Router();
export const adminPoliceRouter = Router();

// Validation Schemas
const TriggerSosSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  deviceInfo: z.string().optional(),
});

const LocationPingSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const PoliceStationSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(5),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  active: z.boolean().default(true),
});

// ==========================================
// 1. PUBLIC / USER SOS ENDPOINTS
// ==========================================

/**
 * POST /api/sos
 * Immediate emergency SOS distress trigger (ARCHITECTURE.md §9)
 * Non-negotiable copy rule: "alert sent to registered police/security contacts" and Call 112 button.
 */
sosRouter.post('/', optionalAuthenticate, async (req: AuthenticatedRequest, res: Response) => {
  const parseResult = TriggerSosSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parseResult.error.errors[0].message,
      },
    });
  }

  const { lat, lng, accuracy } = parseResult.data;

  // Resolve user id (Strictly non-anonymous for SOS)
  let userId = req.user?.id;
  let userInfo: { username: string; email: string; phone?: string | null; role: string } | undefined;

  if (req.user) {
    userInfo = {
      username: req.user.username,
      email: req.user.collegeEmail,
      phone: req.user.phone,
      role: req.user.role,
    };
  } else {
    // If guest triggers SOS, bind to a system student account or create guest responder
    let defaultUser = await prisma.user.findFirst({
      where: { role: Role.STUDENT },
    });
    if (!defaultUser) {
      defaultUser = await prisma.user.findFirst();
    }
    if (defaultUser) {
      userId = defaultUser.id;
      userInfo = {
        username: 'Guest Campus Visitor',
        email: defaultUser.collegeEmail,
        phone: 'Unregistered device',
        role: 'GUEST',
      };
    } else {
      return res.status(500).json({
        error: { code: 'SERVER_ERROR', message: 'No registered user profile available for SOS binding.' },
      });
    }
  }

  try {
    // Create SOS event record
    const sosEvent = await prisma.sosEvent.create({
      data: {
        userId: userId!,
        lat,
        lng,
        accuracy: accuracy || null,
        status: SosStatus.TRIGGERED,
      },
    });

    // Store initial location ping
    await prisma.sosLocationPing.create({
      data: {
        sosId: sosEvent.id,
        lat,
        lng,
      },
    });

    // Immediate dispatch (Haversine nearest police stations + security desk)
    const dispatchResult = await dispatchSosAlert(sosEvent.id, lat, lng, accuracy, userInfo);

    // Update status to DISPATCHED with recipient audit
    const updatedSos = await prisma.sosEvent.update({
      where: { id: sosEvent.id },
      data: {
        status: SosStatus.DISPATCHED,
        dispatchedTo: dispatchResult.dispatchedTo as any,
      },
      include: {
        user: { select: { username: true, collegeEmail: true, phone: true } },
      },
    });

    return res.status(201).json({
      sos: updatedSos,
      nearestStations: dispatchResult.nearestStations,
      emergencyHotlines: dispatchResult.emergencyHotlines,
      message: 'Alert sent to registered police/security contacts. Speed dial 112 active.',
    });
  } catch (error: any) {
    return res.status(500).json({
      error: { code: 'SERVER_ERROR', message: error.message },
    });
  }
});

/**
 * POST /api/sos/:id/ping
 * Periodic location ping streaming (every 15s for up to 15min)
 */
sosRouter.post('/:id/ping', async (req: Request, res: Response) => {
  const { id } = req.params;
  const parseResult = LocationPingSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
    });
  }

  const { lat, lng } = parseResult.data;

  const sos = await prisma.sosEvent.findUnique({ where: { id } });
  if (!sos) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'SOS event not found.' } });
  }

  const ping = await prisma.sosLocationPing.create({
    data: {
      sosId: id,
      lat,
      lng,
    },
  });

  // Broadcast ping to security console
  sosBus.broadcast('sos_ping', {
    sosId: id,
    lat,
    lng,
    timestamp: ping.createdAt.toISOString(),
  });

  return res.status(200).json({ success: true, pingId: ping.id });
});

/**
 * PATCH /api/sos/:id/cancel
 * Cancel window (10s countdown) or mark as false alarm
 */
sosRouter.patch('/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason = 'Canceled by user within countdown window' } = req.body;

  const sos = await prisma.sosEvent.findUnique({ where: { id } });
  if (!sos) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'SOS event not found.' } });
  }

  const updated = await prisma.sosEvent.update({
    where: { id },
    data: { status: SosStatus.FALSE_ALARM },
  });

  sosBus.broadcast('sos_status_changed', {
    sosId: id,
    status: SosStatus.FALSE_ALARM,
    reason,
    timestamp: new Date().toISOString(),
  });

  return res.status(200).json({
    message: 'SOS emergency alert canceled.',
    sos: updated,
  });
});

/**
 * GET /api/sos/:id
 * User status poll for their active SOS
 */
sosRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const sos = await prisma.sosEvent.findUnique({
    where: { id },
    include: {
      pings: { orderBy: { createdAt: 'desc' }, take: 10 },
      user: { select: { username: true, phone: true } },
    },
  });

  if (!sos) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'SOS event not found.' } });
  }

  return res.status(200).json({ sos });
});

// ==========================================
// 2. SECURITY CONSOLE ENDPOINTS
// ==========================================

/**
 * GET /api/security/sos/stream
 * Realtime SSE stream for Security Officers and Admins
 */
securityRouter.get(
  '/stream',
  authenticate,
  requireRole([Role.SECURITY, Role.ADMIN, Role.SUPER_ADMIN]),
  (req: AuthenticatedRequest, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clientId = `sec-${req.user!.id}-${Date.now()}`;
    sosBus.subscribe(clientId, res);
  }
);

/**
 * GET /api/security/sos
 * Active and past SOS event logs
 */
securityRouter.get(
  '/',
  authenticate,
  requireRole([Role.SECURITY, Role.ADMIN, Role.SUPER_ADMIN]),
  async (_req: AuthenticatedRequest, res: Response) => {
    const events = await prisma.sosEvent.findMany({
      include: {
        user: { select: { id: true, username: true, collegeEmail: true, phone: true, department: true } },
        pings: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.status(200).json({ events });
  }
);

/**
 * PATCH /api/security/sos/:id/status
 * Security action: ACK, RESPONDING, RESOLVED, FALSE_ALARM
 */
securityRouter.patch(
  '/:id/status',
  authenticate,
  requireRole([Role.SECURITY, Role.ADMIN, Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!Object.values(SosStatus).includes(status)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid SOS status.' } });
    }

    const updated = await prisma.sosEvent.update({
      where: { id },
      data: { status },
      include: { user: { select: { username: true } } },
    });

    sosBus.broadcast('sos_status_changed', {
      sosId: id,
      status,
      updatedBy: req.user!.username,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ sos: updated });
  }
);

// ==========================================
// 3. SUPER ADMIN POLICE STATION MANAGEMENT
// ==========================================

/**
 * GET /api/admin/police-stations
 */
adminPoliceRouter.get(
  '/',
  authenticate,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN, Role.SECURITY]),
  async (_req: AuthenticatedRequest, res: Response) => {
    const stations = await prisma.policeStation.findMany({
      orderBy: { name: 'asc' },
    });
    return res.status(200).json({ stations });
  }
);

/**
 * POST /api/admin/police-stations
 */
adminPoliceRouter.post(
  '/',
  authenticate,
  requireRole([Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parseResult = PoliceStationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message } });
    }

    const station = await prisma.policeStation.create({ data: parseResult.data });
    return res.status(201).json({ station });
  }
);

/**
 * PATCH /api/admin/police-stations/:id
 */
adminPoliceRouter.patch(
  '/:id',
  authenticate,
  requireRole([Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const station = await prisma.policeStation.update({
      where: { id },
      data: req.body,
    });
    return res.status(200).json({ station });
  }
);

/**
 * DELETE /api/admin/police-stations/:id
 */
adminPoliceRouter.delete(
  '/:id',
  authenticate,
  requireRole([Role.SUPER_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await prisma.policeStation.delete({ where: { id } });
    return res.status(200).json({ message: 'Police station deleted.' });
  }
);
