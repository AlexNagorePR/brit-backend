import type { BatteryRepository, BatteryUser } from '@/application/ports/battery-repository.js';

export class ListBatteryUsers {
  constructor(private readonly batteryRepository: BatteryRepository) {}

  execute(id: string): Promise<BatteryUser[]> {
    return this.batteryRepository.listUsers(id);
  }
}
