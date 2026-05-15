import { describe, it, expect, vi } from 'vitest';
import { Robot } from '@/domain/models/robot.js';
import { ListRunningDevices } from '@/application/use-cases/devices/list-running-devices.js';
import { SyncRobotsFromPortal } from '@/application/use-cases/robots/sync-robots-from-portal.js';

function createRobotRepository(overrides = {}) {
  return {
    list: vi.fn(),
    listForUser: vi.fn(),
    findById: vi.fn(),
    updateName: vi.fn(),
    updateClient: vi.fn(),
    syncSnapshot: vi.fn(),
    listUsers: vi.fn(),
    setUsers: vi.fn(),
    ...overrides,
  };
}

describe('Portal use cases', () => {
  it('syncs valid Portal robots into the robot repository', async () => {
    const portalApi = {
      listRobotInfo: vi.fn().mockResolvedValue({
        old_robot: {},
        robot_1: {
          os: { hostname: ' robot-1.local ' },
          clientId: 'client-1',
        },
      }),
      listRunningRobots: vi.fn(),
      listRunningRobotDetails: vi.fn(),
    };
    const robotRepository = createRobotRepository({
      syncSnapshot: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new SyncRobotsFromPortal(portalApi as any, robotRepository as any);

    await expect(useCase.execute()).resolves.toEqual({
      count: 1,
      robots: [
        {
          id: 'robot_1',
          clientId: 'client-1',
          hostName: 'robot-1.local',
          robotName: 'robot-1.local',
        },
      ],
    });
    expect(robotRepository.syncSnapshot).toHaveBeenCalledWith([expect.any(Robot)]);
  });

  it('lists running devices with Portal details', async () => {
    const portalApi = {
      listRobotInfo: vi.fn(),
      listRunningRobots: vi.fn(),
      listRunningRobotDetails: vi.fn().mockResolvedValue([
        {
          id: 'robot-1',
          data: {
            '@transitive-robotics': {
              'ros-tool': {},
            },
            status: 'running',
          },
        },
      ]),
    };
    const useCase = new ListRunningDevices(portalApi as any);

    await expect(useCase.execute([
      { id: 'robot-1', robotName: 'Robot One' },
      { id: 'robot-2', robotName: 'Robot Two' },
    ])).resolves.toEqual([
      {
        id: 'robot-1',
        name: 'Robot One',
        online: true,
        hasRosTool: true,
        '@transitive-robotics': {
          'ros-tool': {},
        },
        status: 'running',
      },
    ]);
    expect(portalApi.listRunningRobotDetails).toHaveBeenCalledWith([
      'robot-1',
      'robot-2',
    ]);
  });
});
