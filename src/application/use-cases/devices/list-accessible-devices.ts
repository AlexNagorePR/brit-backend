import type { DeviceTelemetryStream } from '@/application/ports/device-telemetry-stream.js';
import type { PortalApi } from '@/application/ports/portal-api.js';
import type { RobotReadModel, RobotRepository } from '@/application/ports/robot-repository.js';
import { DeviceDataSourceError } from './errors.js';
import { ListRunningDevices, type RunningDeviceResult } from './list-running-devices.js';

export type ListAccessibleDevicesCommand = {
  userId: string;
};

export class ListAccessibleDevices {
  private readonly listRunningDevices: ListRunningDevices;

  constructor(
    private readonly robotRepository: Pick<RobotRepository, 'listForUser'>,
    portalApi: PortalApi,
    private readonly telemetryStream: DeviceTelemetryStream
  ) {
    this.listRunningDevices = new ListRunningDevices(portalApi);
  }

  async execute(command: ListAccessibleDevicesCommand): Promise<RunningDeviceResult[]> {
    let robots: RobotReadModel[];

    try {
      robots = await this.robotRepository.listForUser(command.userId);
    } catch (err) {
      throw new DeviceDataSourceError('database', 'Devices failed', err);
    }

    let devices: RunningDeviceResult[];

    try {
      devices = await this.listRunningDevices.execute(robots);
    } catch (err) {
      throw new DeviceDataSourceError('portal', 'Portal API request failed', err);
    }

    for (const device of devices) {
      if (device.hasRosTool) {
        void this.telemetryStream.subscribe(device.id).catch(() => undefined);
      }
    }

    return devices;
  }
}
