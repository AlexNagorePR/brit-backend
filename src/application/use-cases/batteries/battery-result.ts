import { Battery } from '@/domain/models/battery.js';

export type BatteryResult = {
  id: string;
  clientId: string;
  serialNumber: string;
  stateOfHealth: number | null;
};

export function toBatteryResult(battery: Battery): BatteryResult {
  return {
    id: battery.getId(),
    clientId: battery.getClientId(),
    serialNumber: battery.getSerialNumber(),
    stateOfHealth: battery.getStateOfHealth() ?? null,
  };
}
