import type {
  CognitoUserSyncItem,
  UserRepository,
} from '@/application/ports/user-repository.js';

export type SyncCognitoUsersResult = {
  count: number;
  users: CognitoUserSyncItem[];
};

export class SyncCognitoUsers {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(users: CognitoUserSyncItem[]): Promise<SyncCognitoUsersResult> {
    await this.userRepository.syncCognitoUsers(users);

    return {
      count: users.length,
      users,
    };
  }
}
