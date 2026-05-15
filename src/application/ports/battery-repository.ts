import { Battery } from '@/domain/models/battery.js';

export type BatteryUser = {
  id: string;
  email: string;
};

export interface BatteryRepository {
  create(battery: Battery): Promise<string>;
  listForClient(clientId: string): Promise<Battery[]>;
  findById(id: string): Promise<Battery | null>;
  updateSerialNumber(id: string, serialNumber: string): Promise<void>;
  delete(id: string): Promise<void>;
  setUsers(id: string, userIds: string[]): Promise<void>;
  listUsers(id: string): Promise<BatteryUser[]>;
}
