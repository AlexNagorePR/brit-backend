import { beforeEach, describe, expect, it, vi } from 'vitest';

function createDeps(overrides: Partial<ReturnType<typeof createDepsBase>> = {}) {
  return {
    ...createDepsBase(),
    ...overrides,
  };
}

function createDepsBase() {
  return {
    robotRepository: {
      list: vi.fn().mockResolvedValue([{ id: 'robot-1', robotName: 'Robot 1' }]),
    },
    portalApi: {
      listRobotInfo: vi.fn(),
      listRunningRobots: vi.fn().mockResolvedValue({}),
      listRunningRobotDetails: vi.fn(),
    },
    telemetryStream: {
      subscribe: vi.fn().mockResolvedValue(undefined),
      getData: vi.fn(),
    },
    workInfoSubscriber: {
      subscribe: vi.fn().mockResolvedValue(undefined),
    },
    robotInfoSubscriber: {
      subscribe: vi.fn().mockResolvedValue(undefined),
    },
  };
}

async function createFreshCollector(deps: ReturnType<typeof createDepsBase>) {
  vi.resetModules();
  const { createCollector } = await import('@/application/services/collector.js');
  return createCollector(deps as any);
}

describe('Collector service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes telemetry when a robot has ros-tool running', async () => {
    const deps = createDeps({
      portalApi: {
        ...createDepsBase().portalApi,
        listRunningRobots: vi.fn().mockResolvedValue({
          'robot-1': {
            '@transitive-robotics': {
              'ros-tool': {},
            },
          },
        }),
      },
    });
    const collector = await createFreshCollector(deps);

    await collector.refreshRobots();

    expect(deps.telemetryStream.subscribe).toHaveBeenCalledWith('robot-1');
    expect(deps.workInfoSubscriber.subscribe).not.toHaveBeenCalled();
    expect(deps.robotInfoSubscriber.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes work and robot info when brit-info is running', async () => {
    const deps = createDeps({
      portalApi: {
        ...createDepsBase().portalApi,
        listRunningRobots: vi.fn().mockResolvedValue({
          'robot-1': {
            '@transitive-robotics': {
              'brit-info': {},
            },
          },
        }),
      },
    });
    const collector = await createFreshCollector(deps);

    await collector.refreshRobots();

    expect(deps.workInfoSubscriber.subscribe).toHaveBeenCalledWith('robot-1');
    expect(deps.robotInfoSubscriber.subscribe).toHaveBeenCalledWith('robot-1');
    expect(deps.telemetryStream.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes only work info when brit-info-work is running', async () => {
    const deps = createDeps({
      portalApi: {
        ...createDepsBase().portalApi,
        listRunningRobots: vi.fn().mockResolvedValue({
          'robot-1': {
            '@transitive-robotics': {
              'brit-info-work': {},
            },
          },
        }),
      },
    });
    const collector = await createFreshCollector(deps);

    await collector.refreshRobots();

    expect(deps.workInfoSubscriber.subscribe).toHaveBeenCalledWith('robot-1');
    expect(deps.robotInfoSubscriber.subscribe).not.toHaveBeenCalled();
    expect(deps.telemetryStream.subscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe when Portal API fails', async () => {
    const deps = createDeps({
      portalApi: {
        ...createDepsBase().portalApi,
        listRunningRobots: vi.fn().mockRejectedValue(new Error('portal boom')),
      },
    });
    const collector = await createFreshCollector(deps);

    await expect(collector.refreshRobots()).resolves.toBeUndefined();

    expect(deps.robotRepository.list).toHaveBeenCalledTimes(1);
    expect(deps.telemetryStream.subscribe).not.toHaveBeenCalled();
    expect(deps.workInfoSubscriber.subscribe).not.toHaveBeenCalled();
    expect(deps.robotInfoSubscriber.subscribe).not.toHaveBeenCalled();
  });

  it('does not subscribe twice to the same robot', async () => {
    const deps = createDeps({
      portalApi: {
        ...createDepsBase().portalApi,
        listRunningRobots: vi.fn().mockResolvedValue({
          'robot-1': {
            '@transitive-robotics': {
              'ros-tool': {},
              'brit-info': {},
              'brit-info-work': {},
            },
          },
        }),
      },
    });
    const collector = await createFreshCollector(deps);

    await collector.refreshRobots();
    await collector.refreshRobots();

    expect(deps.telemetryStream.subscribe).toHaveBeenCalledTimes(1);
    expect(deps.workInfoSubscriber.subscribe).toHaveBeenCalledTimes(1);
    expect(deps.robotInfoSubscriber.subscribe).toHaveBeenCalledTimes(1);
  });
});
