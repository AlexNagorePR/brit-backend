import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('@/server/auth.js', () => ({
  login: vi.fn(),
  requireLogin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'u1' };
    next();
  },
}));

vi.mock('@/server/ros.js', () => ({
  getBatteryStatus: vi.fn(),
}));

import { createApp } from '@/server/app.js';
import { getBatteryStatus } from '@/server/ros.js';

describe('Battery', () => {
  it('GET /api/battery/:deviceId returns battery status', async () => {
    (getBatteryStatus as any).mockResolvedValue({ percentage: 0.82 });

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/battery/d1').expect(200);

    expect(res.body).toEqual({
      deviceId: 'd1',
      battery_status: { percentage: 0.82 },
    });
  });

  it('GET /api/battery/:deviceId returns 502 if ros fails', async () => {
    (getBatteryStatus as any).mockRejectedValue(new Error('ros boom'));

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/battery/d1').expect(502);

    expect(res.body).toEqual({ error: 'Battery request failed' });
  });
});