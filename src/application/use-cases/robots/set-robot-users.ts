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

    const userIds = [...new Set(
      command.userIds
        .filter((userId: unknown): userId is string => typeof userId === 'string' && userId.trim().length > 0)
        .map(userId => userId.trim().toLowerCase())
    )];

    await this.robotRepository.setUsers(command.robotId, userIds);

    return {
      robotId: command.robotId,
      userIds,
    };
  }
}
