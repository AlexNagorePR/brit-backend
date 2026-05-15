import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.js';

const mockDb = vi.hoisted(() => ({
  getClientByName: vi.fn(),
  getUsersByClient: vi.fn(),
  updateRobotClient: vi.fn(),
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

describe('Admin client references', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PATCH /admin/robots/:robotId/client resolves the client by name', async () => {
    (mockDb.getClientByName as any).mockResolvedValue({
      id: 'client-1',
      name: 'Acme Corp',
    });
    (mockDb.updateRobotClient as any).mockResolvedValue(undefined);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .patch('/admin/robots/robot-1/client')
      .send({ clientName: 'Acme Corp' })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      robotId: 'robot-1',
      clientId: 'client-1',
      clientName: 'Acme Corp',
    });
    expect(mockDb.getClientByName).toHaveBeenCalledWith('Acme Corp');
    expect(mockDb.updateRobotClient).toHaveBeenCalledWith('robot-1', 'client-1');
  });

  it('GET /admin/users/by-client/:clientName lists users for a client', async () => {
    const users = [
      { id: 'user-1', email: 'one@example.com', clientId: 'client-1' },
    ];

    (mockDb.getClientByName as any).mockResolvedValue({
      id: 'client-1',
      name: 'Acme Corp',
    });
    (mockDb.getUsersByClient as any).mockResolvedValue(users);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .get('/admin/users/by-client/Acme%20Corp')
      .expect(200);

    expect(res.body).toEqual({
      clientId: 'client-1',
      clientName: 'Acme Corp',
      users,
    });
    expect(mockDb.getClientByName).toHaveBeenCalledWith('Acme Corp');
    expect(mockDb.getUsersByClient).toHaveBeenCalledWith('client-1');
  });
});
