import type {
  RobotReadModel,
  RobotRepository,
} from '@/application/ports/robot-repository.js';

export class ListRobotsForUser {
  constructor(private readonly robotRepository: RobotRepository) {}

  execute(userId: string): Promise<RobotReadModel[]> {
    return this.robotRepository.listForUser(userId);
  }
}
