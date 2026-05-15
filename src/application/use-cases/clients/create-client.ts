import { Client } from '@/domain/models/client.js';
import type { ClientRepository } from '@/application/ports/client-repository.js';
import { ClientValidationError } from './errors.js';
import { ClientResult } from './client-result.js';

export type CreateClientCommand = {
  name: unknown;
};

export class CreateClient {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(command: CreateClientCommand): Promise<ClientResult> {
    if (typeof command.name !== 'string' || !command.name.trim()) {
      throw new ClientValidationError('name is required and must be a non-empty string');
    }

    const client = this.createDomainClient(command.name);
    const id = await this.clientRepository.create(client);

    return {
      id,
      name: client.getName(),
    };
  }

  private createDomainClient(name: string): Client {
    try {
      return Client.create(name);
    } catch (err) {
      if (err instanceof Error) {
        throw new ClientValidationError(err.message);
      }

      throw err;
    }
  }
}
