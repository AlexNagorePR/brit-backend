import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockDb = vi.hoisted(() => ({
  getRobotIdsForUser: vi.fn(),
}));

vi.mock('@/server/db.js', () => ({
  createDb: () => mockDb,
}));

vi.mock('@/server/auth.js', () => ({
  login: vi.fn(),
  requireLogin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'u1' };
    next();
  },
}));

vi.mock('@/server/portal.js', () => ({
  signPortalApiJWT: vi.fn(() => 'mock-portal-jwt'),
  fetchPortalApi: vi.fn(),
}));

import { createApp } from '@/server/app.js';
import { fetchPortalApi, signPortalApiJWT } from '@/server/portal.js';

describe('Devices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/devices maps portal object into array with id', async () => {
    mockDb.getRobotIdsForUser.mockResolvedValue(['d1', 'd2']);

    (fetchPortalApi as any)
      .mockResolvedValueOnce({ running: true, name: 'Robot 1' })
      .mockResolvedValueOnce({ running: false, name: 'Robot 2' });

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/devices').expect(200);

    expect(mockDb.getRobotIdsForUser).toHaveBeenCalledTimes(1);
    expect(signPortalApiJWT).toHaveBeenCalledTimes(1);
    expect(fetchPortalApi).toHaveBeenCalledTimes(2);

    expect(res.body).toEqual([
      { id: 'd1', running: true, name: 'Robot 1' },
      { id: 'd2', running: false, name: 'Robot 2' },
    ]);
  });

  it('GET /api/devices returns 500 if DB fails', async () => {
    mockDb.getRobotIdsForUser.mockRejectedValue(new Error('db boom'));

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/devices').expect(500);
    expect(res.body).toEqual({ error: 'Devices failed' });
  });

  it('GET /api/devices returns 502 if Portal API fails', async () => {
    mockDb.getRobotIdsForUser.mockResolvedValue(['d1']);
    (fetchPortalApi as any).mockRejectedValue(new Error('portal boom'));

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/devices').expect(502);
    expect(res.body).toEqual({ error: 'Portal API request failed' });
  });
});