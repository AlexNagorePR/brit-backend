export interface DeviceTelemetryStream {
  subscribe(deviceId: string): Promise<void>;
  getData(deviceId: string): unknown;
}
