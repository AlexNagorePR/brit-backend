import type { ClientRepository } from '@/application/ports/client-repository.js';
import type { RobotRepository } from '@/application/ports/robot-repository.js';
import { ClientNotFoundError } from '@/application/use-cases/clients/errors.js';
import { RobotValidationError } from './errors.js';

export type UpdateRobotClientByNameCommand = {
  robotId: string;
  clientName?: unknown;
};

export type UpdateRobotClientByNameResult = {
  robotId: string;
  clientId: string | null;
  clientName: string | null;
};

export class UpdateRobotClientByName {
  constructor(
    private readonly clientRepository: Pick<ClientRepository, 'findByName'>,
    private readonly robotRepository: Pick<RobotRepository, 'updateClient'>
  ) {}

  async execute(command: UpdateRobotClientByNameCommand): Promise<UpdateRobotClientByNameResult> {
    if (
      command.clientName !== null &&
      command.clientName !== undefined &&
      typeof command.clientName !== 'string'
    ) {
      throw new RobotValidationError('clientName must be a string or null');
    }

    if (!command.clientName) {
      await this.robotRepository.updateClient(command.robotId, undefined);

      return {
        robotId: command.robotId,
        clientId: null,
        clientName: null,
      };
    }

    const client = await this.clientRepository.findByName(command.clientName);

    if (!client) {
      throw new ClientNotFoundError(command.clientName);
    }

    await this.robotRepository.updateClient(command.robotId, client.getId());

    return {
      robotId: command.robotId,
      clientId: client.getId(),
      clientName: client.getName(),
    };
  }
}
