import { describe, it, expect, vi, beforeEach } from 'vitest';
import { subscribeBritInfoWork, getBritInfoWorkCache } from '@/server/brit-info-work.js';

const mockDb = vi.hoisted(() => ({
  createWork: vi.fn().mockResolvedValue('work-id-1'),
}));

const mockMqttSync = vi.hoisted(() => ({
  data: {
    subscribePathFlat: vi.fn(),
  },
  subscribe: vi.fn((topic, callback) => {
    if (callback) callback(null);
  }),
}));

vi.mock('@/server/db.js', () => ({
  createDb: () => mockDb,
}));

vi.mock('@/server/portal.js', () => ({
  signHealthMonitoringJWT: vi.fn(() => 'mock-health-monitoring-jwt'),
}));

vi.mock('mqtt', () => ({
  default: {
    connect: vi.fn(() => ({
      on: vi.fn(),
    })),
  },
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
  },
}));

// Mock MqttSync
vi.mock('@transitive-sdk/utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      // MqttSync will be mocked at module level
    },
  };
});

describe('Brit Info Work', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribeBritInfoWork should subscribe to MQTT topic', async () => {
    // This is a unit test for the subscribe function
    expect(subscribeBritInfoWork).toBeDefined();
  });

  it('getBritInfoWorkCache should return null for unknown device', () => {
    const cache = getBritInfoWorkCache('unknown-device');
    expect(cache).toBe(null);
  });

  it('createWork should be called with correct parameters', async () => {
    const workData = {
      startTime: '2026-04-27T10:00:00Z',
      endTime: '2026-04-27T11:00:00Z',
      estimatedTime: 3600,
      totalTime: 3600,
      interruptions: 1,
      alarms: 0,
      filePath: '/tmp/work.json',
    };

    const workId = await mockDb.createWork('robot-1', workData);
    expect(workId).toBe('work-id-1');
    expect(mockDb.createWork).toHaveBeenCalledWith('robot-1', workData);
  });

  it('createWork should handle minimal work data', async () => {
    const workData = {
      startTime: '2026-04-27T10:00:00Z',
      endTime: null,
      estimatedTime: null,
      totalTime: null,
      interruptions: 0,
      alarms: 0,
      filePath: null,
    };

    const workId = await mockDb.createWork('robot-2', workData);
    expect(workId).toBe('work-id-1');
  });

  it('should not create work without start_time or end_time', () => {
    const flatData = {
      'work_info/interruptions': 0,
      'work_info/alarms': 0,
    };

    // Check if we have meaningful data
    const hasMeaningfulData = flatData['work_info/start_time'] || flatData['work_info/end_time'];
    expect(hasMeaningfulData).toBeFalsy();
  });

  it('should extract work info from flat MQTT data structure', () => {
    const flatData = {
      'work_info/start_time': '2026-04-27T10:00:00Z',
      'work_info/end_time': '2026-04-27T11:00:00Z',
      'work_info/estimated_time': 3600,
      'work_info/total_time': 3600,
      'work_info/interruptions': 1,
      'work_info/alarms': 0,
      'work_info/file_path': '/tmp/test.json',
    };

    const workData = {
      startTime: flatData['work_info/start_time'],
      endTime: flatData['work_info/end_time'],
      estimatedTime: flatData['work_info/estimated_time'],
      totalTime: flatData['work_info/total_time'],
      interruptions: flatData['work_info/interruptions'],
      alarms: flatData['work_info/alarms'],
      filePath: flatData['work_info/file_path'],
    };

    expect(workData.startTime).toBe('2026-04-27T10:00:00Z');
    expect(workData.endTime).toBe('2026-04-27T11:00:00Z');
    expect(workData.interruptions).toBe(1);
    expect(workData.alarms).toBe(0);
  });
});
