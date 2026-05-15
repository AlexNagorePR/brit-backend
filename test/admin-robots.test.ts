import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.js';

const mockDb = vi.hoisted(() => ({
  getAllRobots: vi.fn(),
  getUsersForRobot: vi.fn(),
  setUsersForRobot: vi.fn(),
}));

vi.mock('@/infrastructure/db/postgres/index.js', () => ({
  createDb: () => mockDb,
}));

vi.mock('@/server/auth.js', () => ({
  login: vi.fn(),
  requireLogin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'u1', admin: false };
    next();
  },
  requireAdmin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'admin1', admin: true };
    next();
  },
}));

vi.mock('@/application/services/collector.js', () => ({
  createCollector: () => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    refreshRobots: vi.fn(),
    getStatus: vi.fn(),
  }),
  getCollector: vi.fn(() => null),
}));

describe('Admin robots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /admin/robots returns robots', async () => {
    const robots = [
      {
        id: 'robot-1',
        clientId: null,
        hostName: 'host-1',
        robotName: 'Robot One',
        userEmails: [],
      },
    ];

    (mockDb.getAllRobots as any).mockResolvedValue(robots);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .get('/admin/robots')
      .expect(200);

    expect(res.body).toEqual(robots);
    expect(mockDb.getAllRobots).toHaveBeenCalledTimes(1);
  });

  it('GET /admin/robots/:robotId/users returns robot users', async () => {
    const userIds = ['one@example.com', 'two@example.com'];

    (mockDb.getUsersForRobot as any).mockResolvedValue(userIds);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .get('/admin/robots/robot-1/users')
      .expect(200);

    expect(res.body).toEqual({
      robotId: 'robot-1',
      userIds,
    });
    expect(mockDb.getUsersForRobot).toHaveBeenCalledWith('robot-1');
  });

  it('PUT /admin/robots/:robotId/users sets normalized users', async () => {
    (mockDb.setUsersForRobot as any).mockResolvedValue(undefined);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .put('/admin/robots/robot-1/users')
      .send({
        userIds: [' ONE@EXAMPLE.COM ', 'one@example.com', '', 'two@example.com'],
      })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      robotId: 'robot-1',
      userIds: ['one@example.com', 'two@example.com'],
    });
    expect(mockDb.setUsersForRobot).toHaveBeenCalledWith('robot-1', [
      'one@example.com',
      'two@example.com',
    ]);
  });

  it('PUT /admin/robots/:robotId/users returns 400 if userIds is not an array', async () => {
    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .put('/admin/robots/robot-1/users')
      .send({ userIds: 'one@example.com' })
      .expect(400);

    expect(res.body.error).toBe('userIds must be an array');
    expect(mockDb.setUsersForRobot).not.toHaveBeenCalled();
  });
});
