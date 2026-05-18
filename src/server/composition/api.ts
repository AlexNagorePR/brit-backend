import { GetDeviceTelemetry } from '@/application/use-cases/devices/get-device-telemetry.js';
import { ListAccessibleDevices } from '@/application/use-cases/devices/list-accessible-devices.js';
import { PublishDeviceCommand } from '@/application/use-cases/devices/publish-device-command.js';
import { ListRobotsForUser } from '@/application/use-cases/robots/list-robots-for-user.js';
import { RenameAccessibleRobot } from '@/application/use-cases/robots/rename-accessible-robot.js';
import type { InfrastructureComposition } from './infrastructure.js';

export function composeApi(infrastructure: InfrastructureComposition) {
  const { commandPublisher, portalApi, robotRepository, telemetryStream } = infrastructure;

  return {
    getDeviceTelemetry: new GetDeviceTelemetry(telemetryStream),
    listAccessibleDevices: new ListAccessibleDevices(robotRepository, portalApi, telemetryStream),
    listRobotsForUser: new ListRobotsForUser(robotRepository),
    publishDeviceCommand: new PublishDeviceCommand(robotRepository, commandPublisher),
    renameAccessibleRobot: new RenameAccessibleRobot(robotRepository),
  };
}

export type ApiComposition = ReturnType<typeof composeApi>;
