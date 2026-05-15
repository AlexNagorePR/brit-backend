import { User } from '@/domain/models/user.js';
import type {
  CognitoUserSyncItem,
  UserRepository,
} from '@/application/ports/user-repository.js';
import type { Db } from '@/server/db.js';

type UserDb = Pick<
  Db,
  | 'createUser'
  | 'getAllUsers'
  | 'getUsersByClient'
  | 'getUserById'
  | 'getUserByEmail'
  | 'updateUserClient'
  | 'deleteUser'
  | 'syncCognitoUsers'
>;

function toDomainUser(user: {
  id: string;
  email: string;
  clientId: string | null;
}): User {
  return User.reconstruct(user.id, user.email, user.clientId ?? undefined);
}

export function createDbUserRepository(db: UserDb): UserRepository {
  return {
    create(user: User): Promise<string> {
      return db.createUser(user.getId(), user.getEmail(), user.getClientId());
    },

    async list(): Promise<User[]> {
      const users = await db.getAllUsers();
      return users.map(toDomainUser);
    },

    async listByClient(clientId: string): Promise<User[]> {
      const users = await db.getUsersByClient(clientId);
      return users.map(toDomainUser);
    },

    async findById(userId: string): Promise<User | null> {
      const user = await db.getUserById(userId);
      return user ? toDomainUser(user) : null;
    },

    async findByEmail(email: string): Promise<User | null> {
      const user = await db.getUserByEmail(email);
      return user ? toDomainUser(user) : null;
    },

    updateClient(userId: string, clientId?: string): Promise<void> {
      return db.updateUserClient(userId, clientId ?? null);
    },

    delete(userId: string): Promise<void> {
      return db.deleteUser(userId);
    },

    syncCognitoUsers(users: CognitoUserSyncItem[]): Promise<void> {
      return db.syncCognitoUsers(users);
    },
  };
}
