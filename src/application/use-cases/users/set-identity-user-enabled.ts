import type { UserIdentityProvider } from '@/application/ports/user-identity-provider.js';
import { UserNotFoundError } from './errors.js';

export type SetIdentityUserEnabledCommand = {
  username: string;
  enabled: boolean;
};

export type SetIdentityUserEnabledResult = {
  ok: true;
  username: string;
  enabled: boolean;
};

export class SetIdentityUserEnabled {
  constructor(
    private readonly userIdentityProvider: Pick<UserIdentityProvider, 'disableUser' | 'enableUser'>
  ) {}

  async execute(command: SetIdentityUserEnabledCommand): Promise<SetIdentityUserEnabledResult> {
    try {
      if (command.enabled) {
        await this.userIdentityProvider.enableUser(command.username);
      } else {
        await this.userIdentityProvider.disableUser(command.username);
      }

      return {
        ok: true,
        username: command.username,
        enabled: command.enabled,
      };
    } catch (err) {
      if (isIdentityUserNotFound(err)) {
        throw new UserNotFoundError(command.username);
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
