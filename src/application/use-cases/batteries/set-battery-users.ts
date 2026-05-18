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

    if (!command.userIds.every((userId: unknown): userId is string => typeof userId === 'string')) {
      throw new BatteryValidationError('userIds must be an array of strings');
    }

    const userIds = [...new Set(
      command.userIds
        .map((userId) => userId.trim())
        .filter(Boolean)
    )];

    await this.batteryRepository.setUsers(command.id, userIds);

    return {
      batteryId: command.id,
      userIds,
    };
  }
}
