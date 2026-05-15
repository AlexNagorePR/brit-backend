import type { ClientRepository } from '@/application/ports/client-repository.js';
import { ClientResult, toClientResult } from './client-result.js';

export class FindClientById {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(id: string): Promise<ClientResult | null> {
    const client = await this.clientRepository.findById(id);
    return client ? toClientResult(client) : null;
  }
}
