import { Battery } from '@/domain/models/battery.js';
import type { BatteryRepository } from '@/application/ports/battery-repository.js';
import { BatteryValidationError } from './errors.js';

export type UpdateBatterySerialNumberCommand = {
  id: string;
  serialNumber: unknown;
};

export type UpdateBatterySerialNumberResult = {
  id: string;
  serialNumber: string;
};

export class UpdateBatterySerialNumber {
  constructor(private readonly batteryRepository: BatteryRepository) {}

  async execute(command: UpdateBatterySerialNumberCommand): Promise<UpdateBatterySerialNumberResult> {
    if (typeof command.serialNumber !== 'string' || !command.serialNumber.trim()) {
      throw new BatteryValidationError('serialNumber is required and must be a non-empty string');
    }

    let serialNumber: string;
    try {
      const battery = Battery.create('client-placeholder', command.serialNumber);
      serialNumber = battery.getSerialNumber();
    } catch (err) {
      throw new BatteryValidationError((err as Error).message);
    }

    await this.batteryRepository.updateSerialNumber(command.id, serialNumber);

    return {
      id: command.id,
      serialNumber,
    };
  }
}
