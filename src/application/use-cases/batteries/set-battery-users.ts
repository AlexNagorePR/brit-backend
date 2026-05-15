import type { BatteryRepository } from '@/application/ports/battery-repository.js';
import { BatteryValidationError } from './errors.js';

export type SetBatteryUsersCommand = {
  id: string;
  userIds: unknown;
};

export type SetBatteryUsersResult = {
  batteryId: string;
  userIds: string[];
};

export class SetBatteryUsers {
  constructor(private readonly batteryRepository: BatteryRepository) {}

  async execute(command: SetBatteryUsersCommand): Promise<SetBatteryUsersResult> {
    if (!Array.isArray(command.userIds)) {
      throw new BatteryValidationError('userIds must be an array');
    }

    await this.batteryRepository.setUsers(command.id, command.userIds);

    return {
      batteryId: command.id,
      userIds: command.userIds,
    };
  }
}
