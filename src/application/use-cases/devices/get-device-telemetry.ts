import type { DeviceTelemetryStream } from '@/application/ports/device-telemetry-stream.js';

export type GetDeviceTelemetryResult = {
  deviceId: string;
  telemetry: unknown;
};

export class GetDeviceTelemetry {
  constructor(private readonly telemetryStream: DeviceTelemetryStream) {}

  execute(deviceId: string): GetDeviceTelemetryResult {
    return {
      deviceId,
      telemetry: this.telemetryStream.getData(deviceId),
    };
  }
}
