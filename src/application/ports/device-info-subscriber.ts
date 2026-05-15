export interface DeviceInfoSubscriber {
  subscribe(deviceId: string): Promise<void>;
}
