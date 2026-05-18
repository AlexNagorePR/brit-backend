import type { IdentityUser } from '@/application/ports/user-identity-provider.js';
import type { UserIdentityProvider } from '@/application/ports/user-identity-provider.js';
import type { IdentityUserSyncItem, UserRepository } from '@/application/ports/user-repository.js';
import { toIdentityUserSyncItems } from './identity-user-sync-items.js';

export type SyncIdentityUsersFromProviderResult = {
  count: number;
  users: IdentityUserSyncItem[];
  identityUsers: IdentityUser[];
};

export class SyncIdentityUsersFromProvider {
  constructor(
    private readonly userIdentityProvider: UserIdentityProvider,
    private readonly userRepository: Pick<UserRepository, 'syncIdentityUsers'>
  ) {}

  async execute(): Promise<SyncIdentityUsersFromProviderResult> {
    const identityUsers = await this.userIdentityProvider.listUsers();
    const users = toIdentityUserSyncItems(identityUsers);

    await this.userRepository.syncIdentityUsers(users);

    return {
      count: users.length,
      users,
      identityUsers,
    };
  }
}
