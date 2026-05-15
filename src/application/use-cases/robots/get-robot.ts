import type {
  RobotDetailsReadModel,
  RobotRepository,
} from '@/application/ports/robot-repository.js';
import { RobotNotFoundError } from './errors.js';

export class GetRobot {
  constructor(private readonly robotRepository: RobotRepository) {}

  async execute(robotId: string): Promise<RobotDetailsReadModel> {
    const robot = await this.robotRepository.findById(robotId);

    if (!robot) {
      throw new RobotNotFoundError(robotId);
    }

    return robot;
  }
}
