import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.js';

const mockDb = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAllClients: vi.fn(),
  getClient: vi.fn(),
  getClientByName: vi.fn(),
  deleteClient: vi.fn(),
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

describe('Admin clients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /admin/clients returns clients', async () => {
    const clients = [
      { id: 'client-1', name: 'Acme Corp' },
      { id: 'client-2', name: 'Globex' },
    ];

    (mockDb.getAllClients as any).mockResolvedValue(clients);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .get('/admin/clients')
      .expect(200);

    expect(res.body).toEqual(clients);
    expect(mockDb.getAllClients).toHaveBeenCalledTimes(1);
  });

  it('POST /admin/clients creates a client', async () => {
    (mockDb.createClient as any).mockResolvedValue('client-1');

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .post('/admin/clients')
      .send({ name: '  Acme Corp  ' })
      .expect(201);

    expect(res.body).toEqual({
      ok: true,
      id: 'client-1',
      name: 'Acme Corp',
    });
    expect(mockDb.createClient).toHaveBeenCalledWith('Acme Corp');
  });

  it('POST /admin/clients returns 400 if name is missing', async () => {
    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .post('/admin/clients')
      .send({ name: '   ' })
      .expect(400);

    expect(res.body.error).toBe('name is required and must be a non-empty string');
    expect(mockDb.createClient).not.toHaveBeenCalled();
  });

  it('GET /admin/clients/:id returns a client', async () => {
    const client = { id: 'client-1', name: 'Acme Corp' };

    (mockDb.getClient as any).mockResolvedValue(client);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .get('/admin/clients/client-1')
      .expect(200);

    expect(res.body).toEqual(client);
    expect(mockDb.getClient).toHaveBeenCalledWith('client-1');
  });

  it('GET /admin/clients/:id returns 404 if client is missing', async () => {
    (mockDb.getClient as any).mockResolvedValue(null);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .get('/admin/clients/client-missing')
      .expect(404);

    expect(res.body.error).toBe('Client not found');
  });

  it('DELETE /admin/clients/:id deletes an existing client', async () => {
    (mockDb.getClient as any).mockResolvedValue({
      id: 'client-1',
      name: 'Acme Corp',
    });
    (mockDb.deleteClient as any).mockResolvedValue(undefined);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .delete('/admin/clients/client-1')
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      id: 'client-1',
    });
    expect(mockDb.getClient).toHaveBeenCalledWith('client-1');
    expect(mockDb.deleteClient).toHaveBeenCalledWith('client-1');
  });

  it('DELETE /admin/clients/:id returns 404 if client is missing', async () => {
    (mockDb.getClient as any).mockResolvedValue(null);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .delete('/admin/clients/client-missing')
      .expect(404);

    expect(res.body.error).toBe('Client not found');
    expect(mockDb.deleteClient).not.toHaveBeenCalled();
  });
});
