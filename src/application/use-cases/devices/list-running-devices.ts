import type { PortalApi } from '@/application/ports/portal-api.js';
import type { RobotReadModel } from '@/application/ports/robot-repository.js';

export type RunningDeviceResult = {
  id: string;
  name: string | undefined;
  online: true;
  hasRosTool: boolean;
  [key: string]: unknown;
};

export class ListRunningDevices {
  constructor(private readonly portalApi: PortalApi) {}

  async execute(robots: RobotReadModel[]): Promise<RunningDeviceResult[]> {
    const robotById = new Map(robots.map((robot) => [robot.id, robot]));
    const runningRobots = await this.portalApi.listRunningRobotDetails(
      robots.map((robot) => robot.id)
    );

    return runningRobots.map(({ id, data }) => {
      const robot = robotById.get(id);
      const hasRosTool = Boolean(
        data?.['@transitive-robotics']?.['ros-tool']
      );

      return {
        id,
        name: robot?.robotName,
        online: true,
        hasRosTool,
        ...(data || {}),
      };
    });
  }
}
