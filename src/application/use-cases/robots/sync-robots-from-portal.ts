import type { PortalApi } from '@/application/ports/portal-api.js';
import type { RobotRepository } from '@/application/ports/robot-repository.js';
import {
  SyncRobotItem,
  SyncRobotsSnapshot,
  SyncRobotsSnapshotResult,
} from './sync-robots-snapshot.js';

export class SyncRobotsFromPortal {
  private readonly syncRobotsSnapshot: SyncRobotsSnapshot;

  constructor(
    private readonly portalApi: PortalApi,
    robotRepository: RobotRepository
  ) {
    this.syncRobotsSnapshot = new SyncRobotsSnapshot(robotRepository);
  }

  async execute(): Promise<SyncRobotsSnapshotResult> {
    const data = await this.portalApi.listRobotInfo();
    const robots: SyncRobotItem[] = Object.entries(data || {})
      .filter(([, value]) => Boolean(value?.os?.hostname))
      .map(([id, value]) => ({
        id,
        clientId: value?.clientId,
        hostName: value!.os!.hostname!,
        robotName: value!.os!.hostname!,
      }));

    return this.syncRobotsSnapshot.execute(robots);
  }
}
