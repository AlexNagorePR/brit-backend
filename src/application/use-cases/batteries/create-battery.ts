import { Battery } from '@/domain/models/battery.js';
import type { BatteryRepository } from '@/application/ports/battery-repository.js';
import type { ClientRepository } from '@/application/ports/client-repository.js';
import { BatteryValidationError, ClientNotFoundError } from './errors.js';

export type CreateBatteryCommand = {
  clientId: unknown;
  serialNumber: unknown;
  stateOfHealth?: unknown;
};

export type CreateBatteryResult = {
  id: string;
  clientId: string;
  serialNumber: string;
  stateOfHealth: number | null;
};

export { ClientNotFoundError };
export { BatteryValidationError as CreateBatteryValidationError };

type CreateBatteryDeps = {
  batteryRepository: BatteryRepository;
  clientRepository: ClientRepository;
};

export class CreateBattery {
  private batteryRepository: BatteryRepository;
  private clientRepository: ClientRepository;

  constructor(deps: CreateBatteryDeps) {
    this.batteryRepository = deps.batteryRepository;
    this.clientRepository = deps.clientRepository;
  }

  async execute(command: CreateBatteryCommand): Promise<CreateBatteryResult> {
    const battery = this.createDomainBattery(command);
    const clientExists = await this.clientRepository.exists(battery.getClientId());

    if (!clientExists) {
      throw new ClientNotFoundError(battery.getClientId());
    }

    const id = await this.batteryRepository.create(battery);

    return {
      id,
      clientId: battery.getClientId(),
      serialNumber: battery.getSerialNumber(),
      stateOfHealth: battery.getStateOfHealth() ?? null,
    };
  }

  private createDomainBattery(command: CreateBatteryCommand): Battery {
    if (typeof command.clientId !== 'string' || !command.clientId.trim()) {
      throw new BatteryValidationError('clientId is required and must be a string');
    }

    if (typeof command.serialNumber !== 'string' || !command.serialNumber.trim()) {
      throw new BatteryValidationError('serialNumber is required and must be a non-empty string');
    }

    const stateOfHealth = typeof command.stateOfHealth === 'number'
      ? command.stateOfHealth
      : undefined;

    try {
      return Battery.create(command.clientId, command.serialNumber, stateOfHealth);
    } catch (err) {
      throw new BatteryValidationError((err as Error).message);
    }
  }
}
