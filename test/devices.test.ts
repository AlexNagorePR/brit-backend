import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.js';
import { fetchPortalApi, signPortalApiJWT } from '@/server/portal.js';

const mockDb = vi.hoisted(() => ({
  getRobotIdsForUser: vi.fn(),
}));

const mockTelemetryStream = vi.hoisted(() => ({
  subscribe: vi.fn(),
  getData: vi.fn(),
}));

const mockCommandPublisher = vi.hoisted(() => ({
  initialize: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/infrastructure/db/postgres/index.js', () => ({
  createDb: () => mockDb,
}));

vi.mock('@/server/auth.js', () => ({
  login: vi.fn(),
  requireLogin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'u1', email: 'user@example.com' };
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

vi.mock('@/infrastructure/transitive/device-data-stream.js', () => ({
  createTransitiveDeviceTelemetryStream: () => mockTelemetryStream,
}));

vi.mock('@/infrastructure/transitive/device-command-publisher.js', () => ({
  createTransitiveDeviceCommandPublisher: () => mockCommandPublisher,
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

describe('Devices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTelemetryStream.subscribe.mockResolvedValue(undefined);
    mockTelemetryStream.getData.mockReturnValue(null);
    mockCommandPublisher.initialize.mockResolvedValue(undefined);
    mockCommandPublisher.publish.mockResolvedValue(undefined);
  });

  it('GET /api/devices maps portal object into array with id', async () => {
    mockDb.getRobotIdsForUser.mockResolvedValue([
      { id: 'd1', robotName: 'Robot 1' },
      { id: 'd2', robotName: 'Robot 2' },
    ]);

    (fetchPortalApi as any)
      .mockResolvedValueOnce({
        d1: {
          '@transitive-robotics': {},
        },
      })
      .mockResolvedValueOnce({});

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/devices').expect(200);

    expect(mockDb.getRobotIdsForUser).toHaveBeenCalledTimes(1);
    expect(mockDb.getRobotIdsForUser).toHaveBeenCalledWith('user@example.com');
    expect(signPortalApiJWT).toHaveBeenCalledTimes(1);
    expect(fetchPortalApi).toHaveBeenCalledTimes(2);

    expect(res.body).toEqual([
      { id: 'd1', name: 'Robot 1', online: true, hasRosTool: false },
    ]);
    expect(mockTelemetryStream.subscribe).not.toHaveBeenCalled();
  });

  it('GET /api/devices subscribes telemetry for devices with ros-tool', async () => {
    mockDb.getRobotIdsForUser.mockResolvedValue([
      { id: 'd1', robotName: 'Robot 1' },
    ]);

    (fetchPortalApi as any)
      .mockResolvedValueOnce({
        d1: {
          '@transitive-robotics': {},
        },
      })
      .mockResolvedValueOnce({
        '@transitive-robotics': {
          'ros-tool': {},
        },
      });

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/devices').expect(200);

    expect(res.body).toEqual([
      {
        id: 'd1',
        name: 'Robot 1',
        online: true,
        hasRosTool: true,
        '@transitive-robotics': {
          'ros-tool': {},
        },
      },
    ]);
    expect(mockTelemetryStream.subscribe).toHaveBeenCalledWith('d1');
  });

  it('GET /api/data/:deviceId returns telemetry from the telemetry port', async () => {
    mockTelemetryStream.getData.mockReturnValue({
      battery: 85,
      state: 'AUTO',
    });

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/data/d1').expect(200);

    expect(mockTelemetryStream.getData).toHaveBeenCalledWith('d1');
    expect(res.body).toEqual({
      deviceId: 'd1',
      telemetry: {
        battery: 85,
        state: 'AUTO',
      },
    });
  });

  it('POST /api/commands/:deviceId publishes commands through the command publisher port', async () => {
    mockDb.getRobotIdsForUser.mockResolvedValue([
      { id: 'd1', robotName: 'Robot 1' },
    ]);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const message = { data: 1 };
    const res = await request(app)
      .post('/api/commands/d1')
      .send({
        topic: '/ink_level',
        message,
      })
      .expect(200);

    expect(mockDb.getRobotIdsForUser).toHaveBeenCalledWith('user@example.com');
    expect(mockCommandPublisher.initialize).toHaveBeenCalledWith('d1');
    expect(mockCommandPublisher.publish).toHaveBeenCalledWith('d1', '/ink_level', message);
    expect(res.body).toEqual({
      ok: true,
      deviceId: 'd1',
      topic: '/ink_level',
      message,
    });
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
    mockDb.getRobotIdsForUser.mockResolvedValue([{ id: 'd1', robotName: 'Robot 1' }]);
    (fetchPortalApi as any).mockRejectedValueOnce(new Error('portal boom'));

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app).get('/api/devices').expect(502);
    expect(res.body).toEqual({ error: 'Portal API request failed' });
  });
});
