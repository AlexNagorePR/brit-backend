import type { UserRepository } from '@/application/ports/user-repository.js';
import { UserResult, toUserResult } from './user-result.js';

export class ListUsers {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(): Promise<UserResult[]> {
    const users = await this.userRepository.list();
    return users.map(toUserResult);
  }
}
