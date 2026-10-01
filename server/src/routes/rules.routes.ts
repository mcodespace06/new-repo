import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requirePermission, AuthenticatedRequest } from '../services/auth/rbac';
import { ingestRuleChunks } from '../services/rules/chunking';
import { askRulesAssistant } from '../services/rules/rag';

export const rulesRouter = Router();
export const adminRulesRouter = Router();
export const assistantRouter = Router();

// Validation Schemas
const CreateRuleSchema = z.object({
  title: z.string().min(3).max(200),
  category: z.string().min(2).max(100),
  bodyMd: z.string().min(10),
});

const UpdateRuleSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  category: z.string().min(2).max(100).optional(),
  bodyMd: z.string().min(10),
  changeNote: z.string().max(300).optional(),
});

const AskRulesSchema = z.object({
  query: z.string().min(2).max(1000),
  sessionId: z.string().uuid().optional(),
});

// ==========================================
// 1. PUBLIC RULES ROUTES (/api/rules)
// ==========================================

/**
 * GET /api/rules
 * List all active rule documents
 */
rulesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { category, q } = req.query;

    const whereClause: any = {};
    if (typeof category === 'string' && category !== 'ALL') {
      whereClause.category = category;
    }
    if (typeof q === 'string' && q.trim()) {
      whereClause.OR = [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { bodyMd: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }

    const rules = await prisma.ruleDocument.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        category: true,
        version: true,
        updatedBy: true,
        updatedAt: true,
        _count: {
          select: { chunks: true, versions: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.status(200).json({ rules });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

/**
 * POST /api/rules/ask
 * Ask AI policy assistant (Public or authenticated)
 */
rulesRouter.post('/ask', optionalAuthenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = AskRulesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.format() } });
    }

    const { query, sessionId } = parsed.data;
    const userId = req.user?.id;

    const result = await askRulesAssistant({
      query,
      userId,
      sessionId,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

/**
 * GET /api/rules/:id
 * Retrieve single rule document with full markdown and version log
 */
rulesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await prisma.ruleDocument.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          select: { id: true, version: true, changeNote: true, changedBy: true, createdAt: true },
        },
        chunks: {
          select: { id: true, sectionLabel: true },
        },
      },
    });

    if (!rule) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule document not found.' } });
    }

    return res.status(200).json({ rule });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ==========================================
// 2. ADMIN RULES CRUD (/api/admin/rules)
// ==========================================

/**
 * POST /api/admin/rules
 * Create new campus policy document (Super Admin only)
 */
adminRulesRouter.post(
  '/',
  authenticate,
  requirePermission('EDIT_RULES'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parsed = CreateRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.format() } });
      }

      const { title, category, bodyMd } = parsed.data;

      // 1. Create document
      const rule = await prisma.ruleDocument.create({
        data: {
          title,
          category,
          bodyMd,
          version: 1,
          updatedBy: req.user!.username,
        },
      });

      // 2. Record initial version
      await prisma.ruleVersion.create({
        data: {
          ruleId: rule.id,
          version: 1,
          bodyMd,
          changedBy: req.user!.username,
          changeNote: 'Initial policy publication',
        },
      });

      // 3. Chunk and ingest
      await ingestRuleChunks(rule.id, title, bodyMd, 1);

      return res.status(201).json({ rule });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
    }
  }
);

/**
 * PUT /api/admin/rules/:id
 * Update rule document, increment version, and re-chunk (Super Admin only)
 */
adminRulesRouter.put(
  '/:id',
  authenticate,
  requirePermission('EDIT_RULES'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = UpdateRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.format() } });
      }

      const existing = await prisma.ruleDocument.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule document not found.' } });
      }

      const nextVersion = existing.version + 1;
      const newTitle = parsed.data.title || existing.title;
      const newCategory = parsed.data.category || existing.category;

      const updated = await prisma.ruleDocument.update({
        where: { id },
        data: {
          title: newTitle,
          category: newCategory,
          bodyMd: parsed.data.bodyMd,
          version: nextVersion,
          updatedBy: req.user!.username,
        },
      });

      await prisma.ruleVersion.create({
        data: {
          ruleId: id,
          version: nextVersion,
          bodyMd: parsed.data.bodyMd,
          changedBy: req.user!.username,
          changeNote: parsed.data.changeNote || `Version ${nextVersion} revision`,
        },
      });

      await ingestRuleChunks(id, newTitle, parsed.data.bodyMd, nextVersion);

      return res.status(200).json({ rule: updated });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
    }
  }
);

/**
 * DELETE /api/admin/rules/:id
 * Delete rule document and associated chunks/versions (Super Admin only)
 */
adminRulesRouter.delete(
  '/:id',
  authenticate,
  requirePermission('EDIT_RULES'),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = _req.params;
      const existing = await prisma.ruleDocument.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rule document not found.' } });
      }

      await prisma.ruleDocument.delete({ where: { id } });
      return res.status(200).json({ message: 'Rule document deleted successfully.' });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
    }
  }
);

// ==========================================
// 3. ASSISTANT SESSIONS (/api/assistant)
// ==========================================

/**
 * POST /api/assistant/chat
 * Multi-turn assistant chat endpoint
 */
assistantRouter.post('/chat', optionalAuthenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = AskRulesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.format() } });
    }

    const { query, sessionId } = parsed.data;
    const userId = req.user?.id;

    const result = await askRulesAssistant({
      query,
      userId,
      sessionId,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

/**
 * GET /api/assistant/sessions
 * List past assistant sessions for authenticated user
 */
assistantRouter.get('/sessions', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = await prisma.assistantSession.findMany({
      where: { userId: req.user!.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.status(200).json({ sessions });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

/**
 * DELETE /api/assistant/sessions/:id
 * Delete assistant session and history (Right to erasure)
 */
assistantRouter.delete('/sessions/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const session = await prisma.assistantSession.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!session) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found.' } });
    }

    await prisma.assistantSession.delete({ where: { id } });
    return res.status(200).json({ message: 'Session deleted successfully.' });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default rulesRouter;
