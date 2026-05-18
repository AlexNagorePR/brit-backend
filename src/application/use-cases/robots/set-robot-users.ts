import type { RobotRepository } from '@/application/ports/robot-repository.js';
import { RobotValidationError } from './errors.js';

export type SetRobotUsersCommand = {
  robotId: string;
  userIds: unknown;
};

export type SetRobotUsersResult = {
  robotId: string;
  userIds: string[];
};

export class SetRobotUsers {
  constructor(private readonly robotRepository: RobotRepository) {}

  async execute(command: SetRobotUsersCommand): Promise<SetRobotUsersResult> {
    if (!Array.isArray(command.userIds)) {
      throw new RobotValidationError('userIds must be an array');
    }

    if (!command.userIds.every((userId: unknown): userId is string => typeof userId === 'string')) {
      throw new RobotValidationError('userIds must be an array of strings');
    }

    const userIds = [...new Set(
      command.userIds
        .map(userId => userId.trim())
        .filter(Boolean)
    )];

    await this.robotRepository.setUsers(command.robotId, userIds);

    return {
      robotId: command.robotId,
      userIds,
    };
  }
}
