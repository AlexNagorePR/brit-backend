import type {
  IdentityUserSyncItem,
  UserRepository,
} from '@/application/ports/user-repository.js';

export type SyncIdentityUsersResult = {
  count: number;
  users: IdentityUserSyncItem[];
};

export class SyncIdentityUsers {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(users: IdentityUserSyncItem[]): Promise<SyncIdentityUsersResult> {
    await this.userRepository.syncIdentityUsers(users);

    return {
      count: users.length,
      users,
    };
  }
}
