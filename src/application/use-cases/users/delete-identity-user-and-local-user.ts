import type { UserIdentityProvider } from '@/application/ports/user-identity-provider.js';
import { DeleteUser } from './delete-user.js';
import { UserValidationError } from './errors.js';

export type DeleteIdentityUserAndLocalUserCommand = {
  username: string;
  currentUserId?: string;
};

export type DeleteIdentityUserAndLocalUserResult = {
  username: string;
};

export class DeleteIdentityUserAndLocalUser {
  constructor(
    private readonly userIdentityProvider: UserIdentityProvider,
    private readonly deleteUser: DeleteUser
  ) {}

  async execute(command: DeleteIdentityUserAndLocalUserCommand): Promise<DeleteIdentityUserAndLocalUserResult> {
    if (command.currentUserId === command.username) {
      throw new UserValidationError('cannot_delete_self');
    }

    await this.userIdentityProvider.deleteUser(command.username);
    await this.deleteUser.execute(command.username);

    return {
      username: command.username,
    };
  }
}
