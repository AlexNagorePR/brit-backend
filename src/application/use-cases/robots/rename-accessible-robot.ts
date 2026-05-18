import type { RobotRepository } from '@/application/ports/robot-repository.js';
import { RobotAccessDeniedError, RobotValidationError } from './errors.js';
import { canAccessRobot } from './robot-access.js';
import { UpdateRobotName, type UpdateRobotNameResult } from './update-robot-name.js';

export type RenameAccessibleRobotCommand = {
  robotId: string;
  userId: string;
  isAdmin?: boolean;
  name: unknown;
};

export class RenameAccessibleRobot {
  private readonly updateRobotName: UpdateRobotName;

  constructor(private readonly robotRepository: RobotRepository) {
    this.updateRobotName = new UpdateRobotName(robotRepository);
  }

  async execute(command: RenameAccessibleRobotCommand): Promise<UpdateRobotNameResult> {
    if (typeof command.name !== 'string' || !command.name.trim()) {
      throw new RobotValidationError('name is required');
    }

    const hasAccess = await canAccessRobot(this.robotRepository, command);

    if (!hasAccess) {
      throw new RobotAccessDeniedError();
    }

    return this.updateRobotName.execute({
      id: command.robotId,
      name: command.name,
    });
  }
}
