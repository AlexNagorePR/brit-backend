import type { RobotRepository } from '@/application/ports/robot-repository.js';

export class ListRobotUsers {
  constructor(private readonly robotRepository: RobotRepository) {}

  execute(robotId: string): Promise<string[]> {
    return this.robotRepository.listUsers(robotId);
  }
}
