import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { prisma } from '../../src/lib/prisma';
import { signToken } from '../../src/services/auth/tokens';
import { Role, SosStatus } from '@prisma/client';

describe('Emergency SOS Subsystem & Security Dispatch (Phase 6)', () => {
  const studentToken = signToken({
    id: 'student-sos-1',
    username: 'student_emergency',
    role: Role.STUDENT,
    status: 'ACTIVE',
    collegeEmail: 'student@college.edu',
  });

  const securityToken = signToken({
    id: 'security-officer-1',
    username: 'guard_patrol',
    role: Role.SECURITY,
    status: 'ACTIVE',
    collegeEmail: 'security@college.edu',
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

  describe('POST /api/sos — Emergency Distress Trigger', () => {
    it('rejects trigger with invalid coordinates', async () => {
      const res = await request(app)
        .post('/api/sos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ lat: 105.0, lng: 72.8 }); // Lat > 90

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('successfully triggers emergency SOS, computes nearest police stations, and dispatches alerts', async () => {
      // Mock police stations in DB
      vi.spyOn(prisma.policeStation, 'findMany').mockResolvedValue([
        {
          id: 'ps-1',
          name: 'Campus Central Police Post',
          email: 'ps.central@police.gov.in',
          phone: '+912226500100',
          lat: 19.0765,
          lng: 72.8780,
          active: true,
          createdAt: new Date(),
        },
        {
          id: 'ps-2',
          name: 'North District Precinct',
          email: 'ps.north@police.gov.in',
          phone: '+912226500200',
          lat: 19.0850,
          lng: 72.8800,
          active: true,
          createdAt: new Date(),
        },
      ]);

      vi.spyOn(prisma.sosEvent, 'create').mockResolvedValue({
        id: 'sos-ev-123',
        userId: 'student-sos-1',
        lat: 19.0760,
        lng: 72.8777,
        accuracy: 10,
        status: SosStatus.TRIGGERED,
        dispatchedTo: [],
        createdAt: new Date(),
      } as any);

      vi.spyOn(prisma.sosLocationPing, 'create').mockResolvedValue({
        id: 'ping-1',
        sosId: 'sos-ev-123',
        lat: 19.0760,
        lng: 72.8777,
        createdAt: new Date(),
      } as any);

      vi.spyOn(prisma.sosEvent, 'update').mockResolvedValue({
        id: 'sos-ev-123',
        userId: 'student-sos-1',
        lat: 19.0760,
        lng: 72.8777,
        accuracy: 10,
        status: SosStatus.DISPATCHED,
        dispatchedTo: [{ name: 'Campus Central Police Post' }],
        createdAt: new Date(),
        user: { username: 'student_emergency', collegeEmail: 'student@college.edu', phone: null },
      } as any);

      const res = await request(app)
        .post('/api/sos')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          lat: 19.0760,
          lng: 72.8777,
          accuracy: 8.5,
        });

      expect(res.status).toBe(201);
      expect(res.body.sos.status).toBe(SosStatus.DISPATCHED);
      expect(res.body.nearestStations.length).toBeGreaterThan(0);
      expect(res.body.nearestStations[0].station.name).toBe('Campus Central Police Post');

      // Non-negotiable copy and speed dial 112 check
      expect(res.body.message).toContain('Alert sent to registered police/security contacts');
      expect(res.body.emergencyHotlines.some((h: any) => h.number === '112')).toBe(true);
    });
  });

  describe('POST /api/sos/:id/ping — Continuous Location Tracking', () => {
    it('accepts and records periodic GPS coordinate pings', async () => {
      vi.spyOn(prisma.sosEvent, 'findUnique').mockResolvedValue({
        id: 'sos-ev-123',
        status: SosStatus.DISPATCHED,
      } as any);

      vi.spyOn(prisma.sosLocationPing, 'create').mockResolvedValue({
        id: 'ping-2',
        sosId: 'sos-ev-123',
        lat: 19.0762,
        lng: 72.8779,
        createdAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/sos/sos-ev-123/ping')
        .send({ lat: 19.0762, lng: 72.8779 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pingId).toBe('ping-2');
    });
  });

  describe('PATCH /api/sos/:id/cancel — 10-Second Cancel Countdown', () => {
    it('marks SOS event as FALSE_ALARM when canceled by student', async () => {
      vi.spyOn(prisma.sosEvent, 'findUnique').mockResolvedValue({
        id: 'sos-ev-123',
        status: SosStatus.DISPATCHED,
      } as any);

      vi.spyOn(prisma.sosEvent, 'update').mockResolvedValue({
        id: 'sos-ev-123',
        status: SosStatus.FALSE_ALARM,
      } as any);

      const res = await request(app)
        .patch('/api/sos/sos-ev-123/cancel')
        .send({ reason: 'Accidental trigger during countdown' });

      expect(res.status).toBe(200);
      expect(res.body.sos.status).toBe(SosStatus.FALSE_ALARM);
    });
  });

  describe('Security Console APIs (ARCHITECTURE.md §9)', () => {
    it('denies student access to security console feed', async () => {
      const res = await request(app)
        .get('/api/security/sos')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('allows security officer to list active and past SOS events', async () => {
      vi.spyOn(prisma.sosEvent, 'findMany').mockResolvedValue([
        {
          id: 'sos-ev-123',
          lat: 19.0760,
          lng: 72.8777,
          status: SosStatus.DISPATCHED,
          createdAt: new Date(),
          user: { id: 'u1', username: 'student_sos', collegeEmail: 's@campus.edu', phone: '9999999999' },
          pings: [],
        } as any,
      ]);

      const res = await request(app)
        .get('/api/security/sos')
        .set('Authorization', `Bearer ${securityToken}`);

      expect(res.status).toBe(200);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0].id).toBe('sos-ev-123');
    });

    it('allows security officer to update SOS status to RESPONDING and RESOLVED', async () => {
      vi.spyOn(prisma.sosEvent, 'update').mockResolvedValue({
        id: 'sos-ev-123',
        status: SosStatus.RESPONDING,
        user: { username: 'student_sos' },
      } as any);

      const res = await request(app)
        .patch('/api/security/sos/sos-ev-123/status')
        .set('Authorization', `Bearer ${securityToken}`)
        .send({ status: SosStatus.RESPONDING });

      expect(res.status).toBe(200);
      expect(res.body.sos.status).toBe(SosStatus.RESPONDING);
    });
  });

  describe('Super Admin Police Station Management', () => {
    it('allows super admin to create a new police precinct', async () => {
      vi.spyOn(prisma.policeStation, 'create').mockResolvedValue({
        id: 'ps-new',
        name: 'South District Station',
        email: 'ps.south@police.gov.in',
        phone: '+912226500400',
        lat: 19.0700,
        lng: 72.8750,
        active: true,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/admin/police-stations')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'South District Station',
          email: 'ps.south@police.gov.in',
          phone: '+912226500400',
          lat: 19.0700,
          lng: 72.8750,
        });

      expect(res.status).toBe(201);
      expect(res.body.station.name).toBe('South District Station');
    });
  });
});
