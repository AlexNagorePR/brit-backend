import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  updateRobotInfo: vi.fn().mockResolvedValue(undefined),
}));

const onDataHandlers = vi.hoisted(() => [] as Array<(arg?: any) => void>);

const mockRosTool = vi.hoisted(() => ({
  deviceData: null as any,
  subscribe: vi.fn(),
  onData: vi.fn((handler: (arg?: any) => void) => {
    onDataHandlers.push(handler);
  }),
}));

const mockImportCapability = vi.hoisted(() => vi.fn().mockResolvedValue(mockRosTool));

vi.mock('@/server/db.js', () => ({
  createDb: () => mockDb,
}));

vi.mock('@/server/portal.js', () => ({
  signRosToolJWT: vi.fn(() => 'mock-jwt'),
}));

vi.mock('@transitive-sdk/utils', () => ({
  default: {
    getLogger: () => ({
      setLevel: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }),
    importCapability: mockImportCapability,
  },
}));

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

describe('Brit Info Robot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onDataHandlers.length = 0;
    mockRosTool.deviceData = null;
  });

  it('subscribes to info_robot topics and stores robot summary fields', async () => {
    const { subscribeRobotInfo } = await import('@/server/brit-info-robot.js');

    await subscribeRobotInfo({
      jwtSecret: 'secret',
      transitiveUser: 'user',
      deviceId: 'device-info-1',
    });

    expect(mockRosTool.subscribe).toHaveBeenCalledWith(2, '/info_robot/fecha_ultima_limpieza');
    expect(mockRosTool.subscribe).toHaveBeenCalledWith(2, '/info_robot/fecha_ultimo_trabajo');
    expect(mockRosTool.subscribe).toHaveBeenCalledWith(2, '/info_robot/num_trabajos');
    expect(mockRosTool.subscribe).toHaveBeenCalledWith(2, '/info_robot/tiempo_total_encendido');
    expect(mockRosTool.subscribe).toHaveBeenCalledWith(2, '/info_robot/tiempo_total_trabajando');
    expect(onDataHandlers).toHaveLength(5);

    mockRosTool.deviceData = {
      ros: {
        2: {
          messages: {
            info_robot: {
              fecha_ultima_limpieza: { data: '2026-05-01 08:00:00' },
              fecha_ultimo_trabajo: { data: '2026-05-02 09:30:00' },
              num_trabajos: { data: 12 },
              tiempo_total_encendido: { data: 1234.5 },
              tiempo_total_trabajando: { data: 678.25 },
            },
          },
        },
      },
    };

    for (const handler of onDataHandlers) {
      handler();
    }
    await flush();

    expect(mockDb.updateRobotInfo).toHaveBeenCalledWith('device-info-1', {
      lastClean: '2026-05-01 08:00:00',
    });
    expect(mockDb.updateRobotInfo).toHaveBeenCalledWith('device-info-1', {
      lastWork: '2026-05-02 09:30:00',
    });
    expect(mockDb.updateRobotInfo).toHaveBeenCalledWith('device-info-1', {
      works: 12,
    });
    expect(mockDb.updateRobotInfo).toHaveBeenCalledWith('device-info-1', {
      timeOn: 1234.5,
    });
    expect(mockDb.updateRobotInfo).toHaveBeenCalledWith('device-info-1', {
      timeWork: 678.25,
    });
  });

  it('also reads flattened info_robot message paths', async () => {
    const { subscribeRobotInfo } = await import('@/server/brit-info-robot.js');

    await subscribeRobotInfo({
      jwtSecret: 'secret',
      transitiveUser: 'user',
      deviceId: 'device-info-2',
    });

    mockRosTool.deviceData = {
      ros: {
        2: {
          messages: {
            'info_robot/num_trabajos': { data: '7' },
          },
        },
      },
    };

    onDataHandlers[2]();
    await flush();

    expect(mockDb.updateRobotInfo).toHaveBeenCalledWith('device-info-2', {
      works: 7,
    });
  });
});
