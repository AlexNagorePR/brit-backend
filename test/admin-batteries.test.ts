import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.ts';

const mockDb = vi.hoisted(() => ({
  getClient: vi.fn(),
  getBatteriesForClient: vi.fn(),
  getBattery: vi.fn(),
  createBattery: vi.fn(),
  updateBattery: vi.fn(),
  deleteBattery: vi.fn(),
  setUsersForBattery: vi.fn(),
  getUsersForBattery: vi.fn(),
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
  requireAdmin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'admin1', admin: true };
    next();
  },
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

describe('Admin batteries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /admin/batteries returns batteries for a client', async () => {
    const batteries = [
      {
        id: 'b1',
        clientId: 'c1',
        serialNumber: 'SN-001',
        stateOfHealth: null,
      },
      {
        id: 'b2',
        clientId: 'c1',
        serialNumber: 'SN-002',
        stateOfHealth: null,
      },
    ];

    (mockDb.getBatteriesForClient as any).mockResolvedValue(batteries);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .get('/admin/batteries?clientId=c1')
      .expect(200);

    expect(res.body).toEqual(batteries);
    expect(mockDb.getBatteriesForClient).toHaveBeenCalledWith('c1');
  });

  it('GET /admin/batteries returns 400 if clientId is missing', async () => {
    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .get('/admin/batteries')
      .expect(400);

    expect(res.body.error).toBe('clientId query parameter is required');
  });

  it('GET /admin/batteries/:id returns battery details', async () => {
    const battery = {
      id: 'b1',
      clientId: 'c1',
      serialNumber: 'SN-001',
      stateOfHealth: null,
    };

    (mockDb.getBattery as any).mockResolvedValue(battery);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .get('/admin/batteries/b1')
      .expect(200);

    expect(res.body).toEqual(battery);
    expect(mockDb.getBattery).toHaveBeenCalledWith('b1');
  });

  it('GET /admin/batteries/:id returns 404 if battery not found', async () => {
    (mockDb.getBattery as any).mockResolvedValue(null);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .get('/admin/batteries/b-nonexistent')
      .expect(404);

    expect(res.body.error).toBe('Battery not found');
  });

  it('POST /admin/batteries creates a new battery', async () => {
    const client = { id: 'c1', name: 'Client One' };
    const newBatteryId = 'b1';

    (mockDb.getClient as any).mockResolvedValue(client);
    (mockDb.createBattery as any).mockResolvedValue(newBatteryId);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .post('/admin/batteries')
      .send({
        clientId: 'c1',
        serialNumber: 'SN-001',
      })
      .expect(201);

    expect(res.body).toEqual({
      ok: true,
      id: newBatteryId,
      clientId: 'c1',
      serialNumber: 'SN-001',
      stateOfHealth: null,
    });

    expect(mockDb.getClient).toHaveBeenCalledWith('c1');
    expect(mockDb.createBattery).toHaveBeenCalledWith('c1', 'SN-001', undefined);
  });

  it('POST /admin/batteries returns 400 if clientId is missing', async () => {
    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .post('/admin/batteries')
      .send({
        serialNumber: 'SN-001',
      })
      .expect(400);

    expect(res.body.error).toBe('clientId is required and must be a string');
  });

  it('POST /admin/batteries returns 400 if serialNumber is missing', async () => {
    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .post('/admin/batteries')
      .send({
        clientId: 'c1',
      })
      .expect(400);

    expect(res.body.error).toBe('serialNumber is required and must be a non-empty string');
    expect(mockDb.getClient).not.toHaveBeenCalled();
    expect(mockDb.createBattery).not.toHaveBeenCalled();
  });

  it('POST /admin/batteries returns 404 if client not found', async () => {
    (mockDb.getClient as any).mockResolvedValue(null);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .post('/admin/batteries')
      .send({
        clientId: 'c-nonexistent',
        serialNumber: 'SN-001',
      })
      .expect(404);

    expect(res.body.error).toBe('Client not found');
  });

  it('PUT /admin/batteries/:id updates a battery', async () => {
    (mockDb.updateBattery as any).mockResolvedValue(undefined);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .put('/admin/batteries/b1')
      .send({
        serialNumber: 'SN-001-UPDATED',
      })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      id: 'b1',
      serialNumber: 'SN-001-UPDATED',
    });

    expect(mockDb.updateBattery).toHaveBeenCalledWith('b1', {
      serialNumber: 'SN-001-UPDATED',
    });
  });

  it('PUT /admin/batteries/:id returns 400 if serialNumber is missing', async () => {
    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .put('/admin/batteries/b1')
      .send({})
      .expect(400);

    expect(res.body.error).toBe('serialNumber is required and must be a non-empty string');
  });

  it('DELETE /admin/batteries/:id deletes a battery', async () => {
    (mockDb.deleteBattery as any).mockResolvedValue(undefined);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .delete('/admin/batteries/b1')
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      id: 'b1',
    });

    expect(mockDb.deleteBattery).toHaveBeenCalledWith('b1');
  });

  it('PUT /admin/batteries/:id/users sets users for a battery', async () => {
    const userIds = ['u1', 'u2', 'u3'];
    (mockDb.setUsersForBattery as any).mockResolvedValue(undefined);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .put('/admin/batteries/b1/users')
      .send({ userIds })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      batteryId: 'b1',
      userIds,
    });

    expect(mockDb.setUsersForBattery).toHaveBeenCalledWith('b1', userIds);
  });

  it('PUT /admin/batteries/:id/users returns 400 if userIds is not an array', async () => {
    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .put('/admin/batteries/b1/users')
      .send({ userIds: 'u1' })
      .expect(400);

    expect(res.body.error).toBe('userIds must be an array');
  });

  it('GET /admin/batteries/:id/users returns users for a battery', async () => {
    const users = [
      { id: 'u1', email: 'user1@example.com' },
      { id: 'u2', email: 'user2@example.com' },
    ];

    (mockDb.getUsersForBattery as any).mockResolvedValue(users);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .get('/admin/batteries/b1/users')
      .expect(200);

    expect(res.body).toEqual(users);
    expect(mockDb.getUsersForBattery).toHaveBeenCalledWith('b1');
  });
});
