export interface DeviceCommandPublisher {
  initialize(deviceId: string): Promise<unknown>;
  publish(deviceId: string, topic: string, message: unknown): Promise<void>;
}
