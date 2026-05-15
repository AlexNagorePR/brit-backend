import { User } from '@/domain/models/user.js';
import type { UserRepository } from '@/application/ports/user-repository.js';
import { UserValidationError } from './errors.js';
import { UserResult, toUserResult } from './user-result.js';

export type CreateUserCommand = {
  id: string;
  email: string;
  clientId?: string | null;
};

export class CreateUser {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(command: CreateUserCommand): Promise<UserResult> {
    const user = this.createDomainUser(command);
    await this.userRepository.create(user);

    return toUserResult(user);
  }

  private createDomainUser(command: CreateUserCommand): User {
    try {
      return User.create(
        command.id,
        command.email,
        command.clientId ?? undefined
      );
    } catch (err) {
      if (err instanceof Error) {
        throw new UserValidationError(err.message);
      }

      throw err;
    }
  }
}
