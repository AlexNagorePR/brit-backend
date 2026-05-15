import type { ClientRepository } from '@/application/ports/client-repository.js';
import { ClientResult, toClientResult } from './client-result.js';

export class ListClients {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(): Promise<ClientResult[]> {
    const clients = await this.clientRepository.list();
    return clients.map(toClientResult);
  }
}
