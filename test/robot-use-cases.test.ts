import { describe, it, expect, vi } from 'vitest';
import { Robot } from '@/domain/models/robot.js';
import { RobotNotFoundError, RobotValidationError } from '@/application/use-cases/robots/errors.js';
import { GetRobot } from '@/application/use-cases/robots/get-robot.js';
import { ListRobots } from '@/application/use-cases/robots/list-robots.js';
import { ListRobotsForUser } from '@/application/use-cases/robots/list-robots-for-user.js';
import { ListRobotUsers } from '@/application/use-cases/robots/list-robot-users.js';
import { SetRobotUsers } from '@/application/use-cases/robots/set-robot-users.js';
import { SyncRobotsSnapshot } from '@/application/use-cases/robots/sync-robots-snapshot.js';
import { UpdateRobotClient } from '@/application/use-cases/robots/update-robot-client.js';
import { UpdateRobotName } from '@/application/use-cases/robots/update-robot-name.js';

function createRepository(overrides = {}) {
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

describe('Robot use cases', () => {
  it('lists robots', async () => {
    const robots = [
      { id: 'robot-1', hostName: 'host-1', robotName: 'Robot One' },
    ];
    const repository = createRepository({
      list: vi.fn().mockResolvedValue(robots),
    });
    const useCase = new ListRobots(repository as any);

    await expect(useCase.execute()).resolves.toEqual(robots);
  });

  it('lists robots for a user', async () => {
    const robots = [
      { id: 'robot-1', hostName: 'host-1', robotName: 'Robot One' },
    ];
    const repository = createRepository({
      listForUser: vi.fn().mockResolvedValue(robots),
    });
    const useCase = new ListRobotsForUser(repository as any);

    await expect(useCase.execute('one@example.com')).resolves.toEqual(robots);
    expect(repository.listForUser).toHaveBeenCalledWith('one@example.com');
  });

  it('gets a robot by id', async () => {
    const robot = {
      id: 'robot-1',
      hostName: 'host-1',
      robotName: 'Robot One',
      works: [],
      cleans: [],
    };
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(robot),
    });
    const useCase = new GetRobot(repository as any);

    await expect(useCase.execute('robot-1')).resolves.toEqual(robot);
    expect(repository.findById).toHaveBeenCalledWith('robot-1');
  });

  it('throws when a robot is not found', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(null),
    });
    const useCase = new GetRobot(repository as any);

    await expect(useCase.execute('missing')).rejects.toThrow(RobotNotFoundError);
  });

  it('updates a robot name', async () => {
    const repository = createRepository({
      updateName: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new UpdateRobotName(repository as any);

    await expect(useCase.execute({
      id: 'robot-1',
      name: '  Robot One  ',
    })).resolves.toEqual({
      robotId: 'robot-1',
      name: 'Robot One',
    });
    expect(repository.updateName).toHaveBeenCalledWith('robot-1', 'Robot One');
  });

  it('rejects an empty robot name', async () => {
    const repository = createRepository();
    const useCase = new UpdateRobotName(repository as any);

    await expect(useCase.execute({
      id: 'robot-1',
      name: '   ',
    })).rejects.toThrow(RobotValidationError);
    expect(repository.updateName).not.toHaveBeenCalled();
  });

  it('updates a robot client', async () => {
    const repository = createRepository({
      updateClient: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new UpdateRobotClient(repository as any);

    await expect(useCase.execute({
      robotId: 'robot-1',
      clientId: 'client-1',
    })).resolves.toEqual({
      robotId: 'robot-1',
      clientId: 'client-1',
    });
    expect(repository.updateClient).toHaveBeenCalledWith('robot-1', 'client-1');
  });

  it('clears a robot client', async () => {
    const repository = createRepository({
      updateClient: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new UpdateRobotClient(repository as any);

    await expect(useCase.execute({
      robotId: 'robot-1',
      clientId: null,
    })).resolves.toEqual({
      robotId: 'robot-1',
      clientId: null,
    });
    expect(repository.updateClient).toHaveBeenCalledWith('robot-1', undefined);
  });

  it('sets robot users', async () => {
    const repository = createRepository({
      setUsers: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new SetRobotUsers(repository as any);

    await expect(useCase.execute({
      robotId: 'robot-1',
      userIds: [' ONE@EXAMPLE.COM ', 'one@example.com', '', 'two@example.com'],
    })).resolves.toEqual({
      robotId: 'robot-1',
      userIds: ['one@example.com', 'two@example.com'],
    });
    expect(repository.setUsers).toHaveBeenCalledWith('robot-1', [
      'one@example.com',
      'two@example.com',
    ]);
  });

  it('rejects invalid robot users input', async () => {
    const repository = createRepository();
    const useCase = new SetRobotUsers(repository as any);

    await expect(useCase.execute({
      robotId: 'robot-1',
      userIds: 'one@example.com',
    })).rejects.toThrow(RobotValidationError);
    expect(repository.setUsers).not.toHaveBeenCalled();
  });

  it('lists robot users', async () => {
    const repository = createRepository({
      listUsers: vi.fn().mockResolvedValue(['one@example.com']),
    });
    const useCase = new ListRobotUsers(repository as any);

    await expect(useCase.execute('robot-1')).resolves.toEqual(['one@example.com']);
    expect(repository.listUsers).toHaveBeenCalledWith('robot-1');
  });

  it('syncs robots through domain models', async () => {
    const repository = createRepository({
      syncSnapshot: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new SyncRobotsSnapshot(repository as any);

    await expect(useCase.execute([
      {
        id: 'robot-1',
        clientId: 'client-1',
        hostName: ' host-1 ',
        robotName: ' Robot One ',
      },
    ])).resolves.toEqual({
      count: 1,
      robots: [
        {
          id: 'robot-1',
          clientId: 'client-1',
          hostName: 'host-1',
          robotName: 'Robot One',
        },
      ],
    });
    expect(repository.syncSnapshot).toHaveBeenCalledWith([expect.any(Robot)]);
  });
});
