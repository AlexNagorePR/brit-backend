import { Robot } from '@/domain/models/robot.js';
import type { RobotRepository } from '@/application/ports/robot-repository.js';
import { RobotValidationError } from './errors.js';

export type SyncRobotItem = {
  id: string;
  clientId?: string | null;
  hostName: string;
  robotName: string;
};

export type SyncRobotsSnapshotResult = {
  count: number;
  robots: SyncRobotItem[];
};

export class SyncRobotsSnapshot {
  constructor(private readonly robotRepository: RobotRepository) {}

  async execute(robots: SyncRobotItem[]): Promise<SyncRobotsSnapshotResult> {
    const domainRobots = robots.map((robot) => this.createDomainRobot(robot));
    await this.robotRepository.syncSnapshot(domainRobots);

    return {
      count: domainRobots.length,
      robots: domainRobots.map((robot) => {
        const clientId = robot.getClientId();

        return {
          id: robot.getId(),
          ...(clientId !== undefined ? { clientId } : {}),
          hostName: robot.getHostName(),
          robotName: robot.getRobotName(),
        };
      }),
    };
  }

  private createDomainRobot(robot: SyncRobotItem): Robot {
    try {
      return Robot.create(
        robot.id,
        robot.hostName,
        robot.robotName,
        robot.clientId ?? undefined
      );
    } catch (err) {
      if (err instanceof Error) {
        throw new RobotValidationError(err.message);
      }

      throw err;
    }
  }
}
