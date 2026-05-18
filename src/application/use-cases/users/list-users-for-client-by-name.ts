import type { ClientRepository } from '@/application/ports/client-repository.js';
import type { UserRepository } from '@/application/ports/user-repository.js';
import { ClientNotFoundError } from '@/application/use-cases/clients/errors.js';
import { UserResult, toUserResult } from './user-result.js';

export type ListUsersForClientByNameResult = {
  clientId: string;
  clientName: string;
  users: UserResult[];
};

export class ListUsersForClientByName {
  constructor(
    private readonly clientRepository: ClientRepository,
    private readonly userRepository: UserRepository
  ) {}

  async execute(clientName: string): Promise<ListUsersForClientByNameResult> {
    const client = await this.clientRepository.findByName(clientName);

    if (!client) {
      throw new ClientNotFoundError(clientName);
    }

    const users = await this.userRepository.listByClient(client.getId());

    return {
      clientId: client.getId(),
      clientName: client.getName(),
      users: users.map(toUserResult),
    };
  }
}
