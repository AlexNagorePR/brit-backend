import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.js';

const mockDb = vi.hoisted(() => ({
  getRobotIdsForUser: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getAllRobots: vi.fn(),
  upsertRobot: vi.fn(),
  updateRobotName: vi.fn(),
  deleteRobot: vi.fn(),
  syncRobotsSnapshot: vi.fn(),
}));

vi.mock('@/server/db.js', () => ({
  createDb: () => mockDb,
}));

vi.mock('@/server/auth.js', () => ({
  login: vi.fn(),
  requireLogin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'u1', admin: false };
    next();
  },
  requireAdmin: (req: any, _res: any, next: any) => next(),
}));

describe('Robot name', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCH /api/robots/:robotId/name updates robot name if assigned to user', async () => {
    mockDb.getRobotIdsForUser.mockResolvedValue([
      { id: 'r1', hostname: 'robot1', name: 'robot1' },
      { id: 'r2', hostname: 'robot2', name: 'robot2' },
    ]);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .patch('/api/robots/r1/rename')
      .send({ name: 'Robot almacén' })
      .expect(200);

    expect(mockDb.updateRobotName).toHaveBeenCalledWith('r1', 'Robot almacén');
    expect(res.body).toEqual({
      ok: true,
      robotId: 'r1',
      name: 'Robot almacén',
    });
  });

  it('PATCH /api/robots/:robotId/name returns 400 if robot is not assigned', async () => {
    mockDb.getRobotIdsForUser.mockResolvedValue([
      { id: 'r2', hostname: 'robot2', name: 'robot2' },
    ]);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .patch('/api/robots/r1/rename')
      .send({ name: 'Robot almacén' })
      .expect(403);

    expect(res.body).toEqual({ error: 'Robot not found' });
    expect(mockDb.updateRobotName).not.toHaveBeenCalled();
  });

  it('PATCH /api/robots/:robotId/name returns 400 if name is invalid', async () => {
    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .patch('/api/robots/r1/rename')
      .send({ name: '   ' })
      .expect(400);

    expect(res.body).toEqual({ error: 'name is required' });
    expect(mockDb.updateRobotName).not.toHaveBeenCalled();
  });
});