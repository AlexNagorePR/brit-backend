import type { ClientRepository } from '@/application/ports/client-repository.js';
import { ClientResult, toClientResult } from './client-result.js';
import { ClientNotFoundError } from './errors.js';

export class GetClient {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(id: string): Promise<ClientResult> {
    const client = await this.clientRepository.findById(id);

    if (!client) {
      throw new ClientNotFoundError(id);
    }

    return toClientResult(client);
  }
}
