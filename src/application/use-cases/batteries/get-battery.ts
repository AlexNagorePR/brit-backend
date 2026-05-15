import type { BatteryRepository } from '@/application/ports/battery-repository.js';
import { BatteryNotFoundError } from './errors.js';
import { BatteryResult, toBatteryResult } from './battery-result.js';

export class GetBattery {
  constructor(private readonly batteryRepository: BatteryRepository) {}

  async execute(id: string): Promise<BatteryResult> {
    const battery = await this.batteryRepository.findById(id);

    if (!battery) {
      throw new BatteryNotFoundError(id);
    }

    return toBatteryResult(battery);
  }
}
