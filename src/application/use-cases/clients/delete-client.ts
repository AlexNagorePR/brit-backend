import type { ClientRepository } from '@/application/ports/client-repository.js';
import { ClientNotFoundError } from './errors.js';

export type DeleteClientResult = {
  id: string;
};

export class DeleteClient {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(id: string): Promise<DeleteClientResult> {
    const client = await this.clientRepository.findById(id);

    if (!client) {
      throw new ClientNotFoundError(id);
    }

    await this.clientRepository.delete(id);

    return { id };
  }
}
