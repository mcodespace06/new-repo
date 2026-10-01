import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';

describe('Health Check API (Phase 0)', () => {
  it('GET /api/health returns 200 with service metadata', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('CampusVoice API Server');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET / returns 200 operational message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('operational');
  });

  it('GET /api/unknown-route returns 404 standardized error', async () => {
    const res = await request(app).get('/api/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
