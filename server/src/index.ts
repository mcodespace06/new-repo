import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';

dotenv.config({ path: '../.env' });
dotenv.config(); // fallback to server/.env if present

const app = express();
const PORT = process.env.PORT || 4000;

// Security & Parsing Middleware
app.use(
  cors({
    origin: process.env.APP_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint (Phase 0 Deliverable)
app.get('/api/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    // Quick probe to verify DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'unavailable';
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'CampusVoice API Server',
    database: dbStatus,
    version: '1.0.0',
  });
});

// Basic Root Info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'CampusVoice API Gateway',
    documentation: '/api/health',
    status: 'operational',
  });
});

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import complaintsRoutes from './routes/complaints.routes';
import rulesRouter, { adminRulesRouter, assistantRouter } from './routes/rules.routes';
import { sosRouter, securityRouter, adminPoliceRouter } from './routes/sos.routes';

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/admin/rules', adminRulesRouter);
app.use('/api/admin/police-stations', adminPoliceRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/rules', rulesRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/sos', sosRouter);
app.use('/api/security/sos', securityRouter);
app.use('/api', complaintsRoutes); // Allows /api/track/:key as specified in ARCHITECTURE.md §7

// Standardized 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested route does not exist.',
    },
  });
});

// Standardized Error Handling Middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[CampusVoice Error]:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : err.message,
    },
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[CampusVoice Server] listening on http://localhost:${PORT}`);
  });
}

export default app;
