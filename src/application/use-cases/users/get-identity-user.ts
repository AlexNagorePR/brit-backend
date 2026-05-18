import type { IdentityUser, UserIdentityProvider } from '@/application/ports/user-identity-provider.js';
import { UserNotFoundError } from './errors.js';

export class GetIdentityUser {
  constructor(private readonly userIdentityProvider: Pick<UserIdentityProvider, 'getUser'>) {}

  async execute(username: string): Promise<IdentityUser> {
    try {
      return await this.userIdentityProvider.getUser(username);
    } catch (err) {
      if (isIdentityUserNotFound(err)) {
        throw new UserNotFoundError(username);
      }

      throw err;
    }
  }
}

function isIdentityUserNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    err.name === 'UserNotFoundException'
  );
}
