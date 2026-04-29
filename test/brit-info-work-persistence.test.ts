import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  createWork: vi.fn().mockResolvedValue('work-id-1'),
  createInterruption: vi.fn().mockResolvedValue('interruption-id-1'),
  createWarning: vi.fn().mockResolvedValue('warning-id-1'),
}));

const onDataHandlers = vi.hoisted(() => [] as Array<() => void>);

const mockRosTool = vi.hoisted(() => ({
  deviceData: null as any,
  subscribe: vi.fn(),
  onData: vi.fn((handler: () => void) => {
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

describe('Brit Info Work persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onDataHandlers.length = 0;
    mockRosTool.deviceData = null;
  });

  it('stores interruptions and warnings once the work snapshot is complete', async () => {
    const { subscribeWorkInfo } = await import('@/server/brit-info-work.js');

    await subscribeWorkInfo({
      jwtSecret: 'secret',
      transitiveUser: 'user',
      deviceId: 'device-1',
    });

    expect(mockRosTool.subscribe).toHaveBeenCalledWith(2, '/brit_info_work');
    expect(onDataHandlers).toHaveLength(1);

    mockRosTool.deviceData = {
      ros: {
        2: {
          messages: {
            brit_info_work: {
              start_time: '2026-04-22 12:00:00',
              json_file_path: '/tmp/test.json',
              estimated_time: 300,
            },
          },
        },
      },
    };

    onDataHandlers[0]();
    await flush();

    expect(mockDb.createWork).not.toHaveBeenCalled();
    expect(mockDb.createInterruption).not.toHaveBeenCalled();
    expect(mockDb.createWarning).not.toHaveBeenCalled();

    mockRosTool.deviceData = {
      ros: {
        2: {
          messages: {
            brit_info_work: {
              start_time: '2026-04-22 12:00:00',
              json_file_path: '/tmp/test.json',
              estimated_time: 300,
              interruptions_count: 1,
              interruptions_detail: [
                {
                  type: 'state_change',
                  new_state: 3,
                  time_from_start: 10.5,
                  timestamp: '2026-04-22 12:00:10',
                },
              ],
              warnings_count: 1,
              warnings_detail: [
                {
                  type: 'warning',
                  time_from_start: 20,
                  timestamp: '2026-04-22 12:00:20',
                  name: 'motor_warning',
                  message: 'overcurrent',
                  level: 1,
                },
              ],
              total_time: 120.5,
              end_time: '2026-04-29 12:02:00',
            },
          },
        },
      },
    };

    onDataHandlers[0]();
    await flush();

    expect(mockDb.createWork).toHaveBeenCalledTimes(1);
    expect(mockDb.createWork).toHaveBeenCalledWith('device-1', {
      startTime: '2026-04-22 12:00:00',
      endTime: '2026-04-29 12:02:00',
      estimatedTime: 300,
      totalTime: 120.5,
      interruptions: 1,
      alarms: 1,
      filePath: '/tmp/test.json',
    });
    expect(mockDb.createInterruption).toHaveBeenCalledTimes(1);
    expect(mockDb.createInterruption).toHaveBeenCalledWith('work-id-1', 3, 10.5, undefined);
    expect(mockDb.createWarning).toHaveBeenCalledTimes(1);
    expect(mockDb.createWarning).toHaveBeenCalledWith('work-id-1', 1, 20);

    onDataHandlers[0]();
    await flush();

    expect(mockDb.createWork).toHaveBeenCalledTimes(1);
    expect(mockDb.createInterruption).toHaveBeenCalledTimes(1);
    expect(mockDb.createWarning).toHaveBeenCalledTimes(1);
  });
});
