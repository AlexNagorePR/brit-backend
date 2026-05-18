import type { IdentityUser, UserIdentityProvider } from '@/application/ports/user-identity-provider.js';
import { CreateUser } from './create-user.js';
import { UserValidationError } from './errors.js';

export type CreateIdentityUserAndLocalUserCommand = {
  email?: unknown;
  temporaryPassword?: string;
  givenName?: string;
  familyName?: string;
  groups?: unknown;
  clientId?: string | null;
};

export class CreateIdentityUserAndLocalUser {
  constructor(
    private readonly userIdentityProvider: UserIdentityProvider,
    private readonly createUser: CreateUser
  ) {}

  async execute(command: CreateIdentityUserAndLocalUserCommand): Promise<IdentityUser> {
    if (!command.email) {
      throw new UserValidationError('email is required');
    }

    if (typeof command.email !== 'string') {
      throw new UserValidationError('email is required');
    }

    if (command.groups !== undefined && !Array.isArray(command.groups)) {
      throw new UserValidationError('groups must be an array of strings');
    }

    if (Array.isArray(command.groups) && !command.groups.every((group) => typeof group === 'string')) {
      throw new UserValidationError('groups must be an array of strings');
    }

    const groups = command.groups as string[] | undefined;

    const user = await this.userIdentityProvider.createUser({
      email: command.email,
      temporaryPassword: command.temporaryPassword,
      givenName: command.givenName,
      familyName: command.familyName,
      groups,
    });

    await this.createUser.execute({
      id: user.username,
      email: command.email,
      clientId: command.clientId,
    });

    return user;
  }
}
