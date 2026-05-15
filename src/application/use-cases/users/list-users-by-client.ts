import type { UserRepository } from '@/application/ports/user-repository.js';
import { UserResult, toUserResult } from './user-result.js';

export class ListUsersByClient {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(clientId: string): Promise<UserResult[]> {
    const users = await this.userRepository.listByClient(clientId);
    return users.map(toUserResult);
  }
}
