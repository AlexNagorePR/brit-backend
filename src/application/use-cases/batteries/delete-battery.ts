import type { BatteryRepository } from '@/application/ports/battery-repository.js';

export type DeleteBatteryResult = {
  id: string;
};

export class DeleteBattery {
  constructor(private readonly batteryRepository: BatteryRepository) {}

  async execute(id: string): Promise<DeleteBatteryResult> {
    await this.batteryRepository.delete(id);
    return { id };
  }
}
