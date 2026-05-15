import type { ClientRepository } from '@/application/ports/client-repository.js';
import { ClientResult, toClientResult } from './client-result.js';
import { ClientNotFoundError } from './errors.js';

export class FindClientByName {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(name: string): Promise<ClientResult> {
    const client = await this.clientRepository.findByName(name);

    if (!client) {
      throw new ClientNotFoundError(name);
    }

    return toClientResult(client);
  }
}
