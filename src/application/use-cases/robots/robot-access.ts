import type { RobotRepository } from '@/application/ports/robot-repository.js';

export type RobotAccessCommand = {
  robotId: string;
  userId: string;
  isAdmin?: boolean;
};

export async function canAccessRobot(
  robotRepository: Pick<RobotRepository, 'listForUser'>,
  command: RobotAccessCommand
): Promise<boolean> {
  if (command.isAdmin) {
    return true;
  }

  const robots = await robotRepository.listForUser(command.userId);
  return robots.some((robot) => robot.id === command.robotId);
}
