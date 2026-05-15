import type { RobotRepository } from '@/application/ports/robot-repository.js';
import { RobotValidationError } from './errors.js';

export type UpdateRobotNameCommand = {
  id: string;
  name: unknown;
};

export type UpdateRobotNameResult = {
  robotId: string;
  name: string;
};

export class UpdateRobotName {
  constructor(private readonly robotRepository: RobotRepository) {}

  async execute(command: UpdateRobotNameCommand): Promise<UpdateRobotNameResult> {
    if (typeof command.name !== 'string' || !command.name.trim()) {
      throw new RobotValidationError('name is required');
    }

    const name = command.name.trim();
    await this.robotRepository.updateName(command.id, name);

    return {
      robotId: command.id,
      name,
    };
  }
}
