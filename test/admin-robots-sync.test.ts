import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.js';
import { fetchPortalApi, signPortalApiJWT } from '@/server/portal.js';

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
    req.session.user = { _id: 'u1', admin: true };
    next();
  },
  requireAdmin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'admin1', admin: true };
    next();
  },
}));

vi.mock('@/server/portal.js', () => ({
  signPortalApiJWT: vi.fn(() => 'mock-portal-jwt'),
  fetchPortalApi: vi.fn(),
}));

vi.mock('@/server/collector.js', () => ({
  createCollector: () => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    refreshRobots: vi.fn(),
    getStatus: vi.fn(),
  }),
  getCollector: vi.fn(() => null),
}));

describe('Admin robots sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /admin/robots/sync filters devices without hostname and syncs valid robots', async () => {
    (fetchPortalApi as any).mockResolvedValue({
      d_old1: {},
      d_old2: {},
      d_robot1: {
        os: {
          hostname: 'robot1',
        },
      },
      d_robot2: {
        os: {
          hostname: 'robot2',
        },
      },
    });

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .post('/admin/robots/sync')
      .expect(200);

    expect(signPortalApiJWT).toHaveBeenCalledTimes(1);
    expect(fetchPortalApi).toHaveBeenCalledTimes(1);

    expect(mockDb.syncRobotsSnapshot).toHaveBeenCalledTimes(1);
    expect(mockDb.syncRobotsSnapshot).toHaveBeenCalledWith(
      '00544dc1-fd10-4a48-a34a-7f1f75a383e2',
      [
        {
          id: 'd_robot1',
          clientId: '00544dc1-fd10-4a48-a34a-7f1f75a383e2',
          hostName: 'robot1',
          robotName: 'robot1',
        },
        {
          id: 'd_robot2',
          clientId: '00544dc1-fd10-4a48-a34a-7f1f75a383e2',
          hostName: 'robot2',
          robotName: 'robot2',
        },
      ]
    );

    expect(res.body).toEqual({
      ok: true,
      count: 2,
      robots: [
        {
          id: 'd_robot1',
          clientId: '00544dc1-fd10-4a48-a34a-7f1f75a383e2',
          hostName: 'robot1',
          robotName: 'robot1',
        },
        {
          id: 'd_robot2',
          clientId: '00544dc1-fd10-4a48-a34a-7f1f75a383e2',
          hostName: 'robot2',
          robotName: 'robot2',
        },
      ],
    });
  });

  it('POST /admin/robots/sync returns 502 if portal fails', async () => {
    (fetchPortalApi as any).mockRejectedValue(new Error('portal boom'));

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .post('/admin/robots/sync')
      .expect(502);

    expect(res.body).toEqual({ error: 'Robot sync failed' });
    expect(mockDb.syncRobotsSnapshot).not.toHaveBeenCalled();
  });
});