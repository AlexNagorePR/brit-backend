import utils from '@transitive-sdk/utils';

import type { Db, RobotInfo } from '@/server/db.js';
import { subscribeTelemetry } from '@/server/telemetry.js';
import { subscribeWorkInfo } from '@/server/brit-info-work.js';
import { subscribeRobotInfo } from '@/server/brit-info-robot.js';
import { fetchPortalApi, signPortalApiJWT } from '@/server/portal.js';

const log = utils.getLogger('collector');
log.setLevel('debug');

type CollectorDeps = {
  db: Db;
  jwtSecret: string;
  transitiveUser: string;
};

class CollectorService {
  private db: Db;
  private jwtSecret: string;
  private transitiveUser: string;

  private started = false;
  private telemetrySubscribedDevices = new Set<string>();
  private britInfoWorkSubscribedDevices = new Set<string>();
  private britInfoRobotSubscribedDevices = new Set<string>();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(deps: CollectorDeps) {
    this.db = deps.db;
    this.jwtSecret = deps.jwtSecret;
    this.transitiveUser = deps.transitiveUser;
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
    let robots: RobotInfo[];

    try {
      robots = await this.db.getAllRobots();
    } catch (err) {
      log.error('Collector failed to load robots from DB', err);
      return;
    }

    const runningMap = await this.loadRunningRobots();

    robots = [{
      id: 'd_b440cd1',
      clientId: '35f22242-715b-448c-9c1e-c0d378f27d6f',
      hostName: 'b440cd1',
      robotName: 'b440cd1',
      userEmails: [ 'alex.nagore@phenomenonrobotics.com' ]
    }];

    for (const robot of robots) {
      // Subscribe to brit-info-work for all robots
      await this.ensureBritInfoWorkSubscribed(robot.id);
      await this.ensureBritInfoRobotSubscribed(robot.id);

      const runningInfo = runningMap[robot.id];
      const hasRosTool = Boolean(
        runningInfo?.['@transitive-robotics']?.['ros-tool']
      );

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

      await subscribeTelemetry({
        jwtSecret: this.jwtSecret,
        transitiveUser: this.transitiveUser,
        deviceId,
      });

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

      await subscribeWorkInfo({
        jwtSecret: this.jwtSecret,
        transitiveUser: this.transitiveUser,
        deviceId,
      });

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

      await subscribeRobotInfo({
        jwtSecret: this.jwtSecret,
        transitiveUser: this.transitiveUser,
        deviceId,
      });

      this.britInfoRobotSubscribedDevices.add(deviceId);

      log.info('Collector subscribed brit-info-robot successfully', { deviceId });
    } catch (err) {
      log.error('Collector failed subscribing brit-info-robot', { deviceId, err });
    }
  }

  async loadRunningRobots(): Promise<Record<string, any>> {
    try {
      const token = signPortalApiJWT({
        jwtSecret: this.jwtSecret,
        transitiveUser: this.transitiveUser,
        validitySeconds: 60,
      });

      const data = await fetchPortalApi<Record<string, any>>(
        token,
        'https://portal.transitiverobotics.com/@transitive-robotics/_robot-agent/api/v1/running/',
        { timeoutMs: 14000 }
      );

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
