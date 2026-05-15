import type {
  RobotReadModel,
  RobotRepository,
} from '@/application/ports/robot-repository.js';

export class ListRobots {
  constructor(private readonly robotRepository: RobotRepository) {}

  execute(): Promise<RobotReadModel[]> {
    return this.robotRepository.list();
  }
}
