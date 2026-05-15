import type { UserRepository } from '@/application/ports/user-repository.js';
import { UserNotFoundError } from './errors.js';
import { UserResult, toUserResult } from './user-result.js';

export type UpdateUserClientCommand = {
  userId: string;
  clientId?: string | null;
};

export class UpdateUserClient {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(command: UpdateUserClientCommand): Promise<UserResult> {
    const user = await this.userRepository.findById(command.userId);

    if (!user) {
      throw new UserNotFoundError(command.userId);
    }

    user.updateClient(command.clientId || undefined);
    await this.userRepository.updateClient(user.getId(), user.getClientId());

    return toUserResult(user);
  }
}
