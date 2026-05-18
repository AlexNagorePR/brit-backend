import type { IdentityUser } from '@/application/ports/user-identity-provider.js';
import type { UserIdentityProvider } from '@/application/ports/user-identity-provider.js';
import type { UserRepository } from '@/application/ports/user-repository.js';
import { toUserResult, type UserResult } from './user-result.js';
import { toIdentityUserSyncItems } from './identity-user-sync-items.js';

export type ListUsersWithIdentitySyncResult = {
  identityUsers: IdentityUser[];
  dbUsers: UserResult[];
  synced: boolean;
};

export class ListUsersWithIdentitySync {
  constructor(
    private readonly userIdentityProvider: UserIdentityProvider,
    private readonly userRepository: Pick<UserRepository, 'list' | 'syncIdentityUsers'>
  ) {}

  async execute(): Promise<ListUsersWithIdentitySyncResult> {
    const identityUsers = await this.userIdentityProvider.listUsers();
    const usersToSync = toIdentityUserSyncItems(identityUsers);

    try {
      await this.userRepository.syncIdentityUsers(usersToSync);
    } catch {
      // Keep the admin listing available even when local synchronization fails.
    }

    let dbUsers: UserResult[] = [];

    try {
      const users = await this.userRepository.list();
      dbUsers = users.map(toUserResult);
    } catch {
      // Keep identity-provider data available even when local DB listing fails.
    }

    return {
      identityUsers,
      dbUsers,
      synced: true,
    };
  }
}
