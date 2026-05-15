import type { RobotRepository } from '@/application/ports/robot-repository.js';

export type UpdateRobotClientCommand = {
  robotId: string;
  clientId?: string | null;
};

export type UpdateRobotClientResult = {
  robotId: string;
  clientId: string | null;
};

export class UpdateRobotClient {
  constructor(private readonly robotRepository: RobotRepository) {}

  async execute(command: UpdateRobotClientCommand): Promise<UpdateRobotClientResult> {
    await this.robotRepository.updateClient(
      command.robotId,
      command.clientId ?? undefined
    );

    return {
      robotId: command.robotId,
      clientId: command.clientId ?? null,
    };
  }
}
