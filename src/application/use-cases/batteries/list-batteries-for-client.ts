import type { BatteryRepository } from '@/application/ports/battery-repository.js';
import { BatteryValidationError } from './errors.js';
import { BatteryResult, toBatteryResult } from './battery-result.js';

export type ListBatteriesForClientQuery = {
  clientId: unknown;
};

export class ListBatteriesForClient {
  constructor(private readonly batteryRepository: BatteryRepository) {}

  async execute(query: ListBatteriesForClientQuery): Promise<BatteryResult[]> {
    if (typeof query.clientId !== 'string' || !query.clientId.trim()) {
      throw new BatteryValidationError('clientId query parameter is required');
    }

    const batteries = await this.batteryRepository.listForClient(query.clientId.trim());
    return batteries.map(toBatteryResult);
  }
}
