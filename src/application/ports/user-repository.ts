import { User } from '@/domain/models/user.js';

export type IdentityUserSyncItem = {
  username: string;
  email: string;
};

export interface UserRepository {
  create(user: User): Promise<string>;
  list(): Promise<User[]>;
  listByClient(clientId: string): Promise<User[]>;
  findById(userId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  updateClient(userId: string, clientId?: string): Promise<void>;
  delete(userId: string): Promise<void>;
  syncIdentityUsers(users: IdentityUserSyncItem[]): Promise<void>;
}
