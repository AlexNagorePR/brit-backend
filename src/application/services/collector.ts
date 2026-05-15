import utils from '@transitive-sdk/utils';

import type { DeviceInfoSubscriber } from '@/application/ports/device-info-subscriber.js';
import type { DeviceTelemetryStream } from '@/application/ports/device-telemetry-stream.js';
import type { PortalApi } from '@/application/ports/portal-api.js';
import type {
  RobotReadModel,
  RobotRepository,
} from '@/application/ports/robot-repository.js';

const log = utils.getLogger('collector');
log.setLevel('debug');

type CollectorDeps = {
  robotRepository: Pick<RobotRepository, 'list'>;
  portalApi: PortalApi;
  telemetryStream: DeviceTelemetryStream;
  workInfoSubscriber: DeviceInfoSubscriber;
  robotInfoSubscriber: DeviceInfoSubscriber;
};

class CollectorService {
  private robotRepository: Pick<RobotRepository, 'list'>;
  private portalApi: PortalApi;
  private telemetryStream: DeviceTelemetryStream;
  private workInfoSubscriber: DeviceInfoSubscriber;
  private robotInfoSubscriber: DeviceInfoSubscriber;

  private started = false;
  private telemetrySubscribedDevices = new Set<string>();
  private britInfoWorkSubscribedDevices = new Set<string>();
  private britInfoRobotSubscribedDevices = new Set<string>();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(deps: CollectorDeps) {
    this.robotRepository = deps.robotRepository;
    this.portalApi = deps.portalApi;
    this.telemetryStream = deps.telemetryStream;
    this.workInfoSubscriber = deps.workInfoSubscriber;
    this.robotInfoSubscriber = deps.robotInfoSubscriber;
  }

  async start() {
    if (this.started) {
      log.debug('Collector already started');
      return;
    }

    this.started = true;

    log.info('Starting collector service');

    await this.refreshRobots();

    this.refreshTimer = setInterval(() => {
      this.refreshRobots().catch((err) => {
        log.error('Collector refresh failed', err);
      });
    }, 60_000);
  }

  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    this.started = false;
  }

  async refreshRobots() {
    let robots: RobotReadModel[];

    try {
      robots = await this.robotRepository.list();
    } catch (err) {
      log.error('Collector failed to load robots', err);
      return;
    }

    const runningMap = await this.loadRunningRobots();

    for (const robot of robots) {
      const runningInfo = runningMap[robot.id];
      const hasRosTool = Boolean(
        runningInfo?.['@transitive-robotics']?.['ros-tool']
      );
      const hasBritInfo = Boolean(
        runningInfo?.['@transitive-robotics']?.['brit-info']
      );
      const hasBritInfoWork = Boolean(
        runningInfo?.['@transitive-robotics']?.['brit-info-work']
      );

      if (hasBritInfoWork || hasBritInfo) {
        await this.ensureBritInfoWorkSubscribed(robot.id);
      }

      if (hasBritInfo) {
        await this.ensureBritInfoRobotSubscribed(robot.id);
      }

      if (hasRosTool) {
        await this.ensureTelemetrySubscribed(robot.id);
      }
    }
  }

  async ensureTelemetrySubscribed(deviceId: string) {
    if (this.telemetrySubscribedDevices.has(deviceId)) {
      return;
    }

    try {
      log.info('Collector subscribing telemetry', { deviceId });

      await this.telemetryStream.subscribe(deviceId);

      this.telemetrySubscribedDevices.add(deviceId);

      log.info('Collector subscribed telemetry successfully', { deviceId });
    } catch (err) {
      log.error('Collector failed subscribing telemetry', { deviceId, err });
    }
  }

  async ensureBritInfoWorkSubscribed(deviceId: string) {
    if (this.britInfoWorkSubscribedDevices.has(deviceId)) {
      return;
    }

    try {
      log.info('Collector subscribing brit-info-work', { deviceId });

      await this.workInfoSubscriber.subscribe(deviceId);

      this.britInfoWorkSubscribedDevices.add(deviceId);

      log.info('Collector subscribed brit-info-work successfully', { deviceId });
    } catch (err) {
      log.error('Collector failed subscribing brit-info-work', { deviceId, err });
    }
  }

  async ensureBritInfoRobotSubscribed(deviceId: string) {
    if (this.britInfoRobotSubscribedDevices.has(deviceId)) {
      return;
    }

    try {
      log.info('Collector subscribing brit-info-robot', { deviceId });

      await this.robotInfoSubscriber.subscribe(deviceId);

      this.britInfoRobotSubscribedDevices.add(deviceId);

      log.info('Collector subscribed brit-info-robot successfully', { deviceId });
    } catch (err) {
      log.error('Collector failed subscribing brit-info-robot', { deviceId, err });
    }
  }

  async loadRunningRobots(): Promise<Record<string, any>> {
    try {
      const data = await this.portalApi.listRunningRobots();
      return data || {};
    } catch (err) {
      log.error('Collector failed loading running robots from portal', err);
      return {};
    }
  }

  getStatus() {
    return {
      started: this.started,
      telemetrySubscribedDevices: [...this.telemetrySubscribedDevices],
      britInfoWorkSubscribedDevices: [...this.britInfoWorkSubscribedDevices],
      britInfoRobotSubscribedDevices: [...this.britInfoRobotSubscribedDevices],
    };
  }
}

let collectorInstance: CollectorService | null = null;

export function createCollector(deps: CollectorDeps) {
  if (!collectorInstance) {
    collectorInstance = new CollectorService(deps);
  }

  return collectorInstance;
}

export function getCollector() {
  return collectorInstance;
}
