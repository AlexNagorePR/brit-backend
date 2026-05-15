import type { UserRepository } from '@/application/ports/user-repository.js';
import { UserResult, toUserResult } from './user-result.js';

export class FindUserById {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<UserResult | null> {
    const user = await this.userRepository.findById(id);
    return user ? toUserResult(user) : null;
  }
}
