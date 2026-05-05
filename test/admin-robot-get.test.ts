import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.js';

const mockDb = vi.hoisted(() => ({
  getRobotById: vi.fn(),
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

vi.mock('@/server/collector.js', () => ({
  createCollector: () => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    refreshRobots: vi.fn(),
    getStatus: vi.fn(),
  }),
  getCollector: vi.fn(() => null),
}));

describe('Admin robot get', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /admin/robots/:robotId returns robot with works/cleans/warnings/interruptions', async () => {
    const robot = {
      id: 'r1',
      clientId: 'c1',
      clientName: 'Client One',
      hostName: 'host1',
      robotName: 'Robot One',
      userEmails: ['u@example.com'],
      works: [
        {
          id: 'w1',
          robotId: 'r1',
          startTime: '2023-01-01T00:00:00Z',
          endTime: '2023-01-01T01:00:00Z',
          estimatedTime: 3600,
          totalTime: 3600,
          filePath: '/path/to/file',
          interruptions: [
            { id: 'i1', workId: 'w1', stateCode: 42, eventTime: 1610000000, returnToAuto: 1610000300 },
          ],
          warnings: [
            { id: 'warn1', workId: 'w1', alarmCode: 7, eventTime: 1610000100 },
          ],
        },
      ],
      cleans: [
        { id: 'c1', robotId: 'r1', date: '2023-01-02', event: 'Start' },
      ],
    };

    (mockDb.getRobotById as any).mockResolvedValue(robot);

    const app = createApp({ oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any });

    const res = await request(app)
      .get('/admin/robots/r1')
      .expect(200);

    expect(res.body).toEqual(robot);
  });
});
