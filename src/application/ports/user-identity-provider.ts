export type IdentityUserAttributes = Record<string, string | undefined>;

export type IdentityUser = {
  username: string;
  enabled?: boolean;
  userStatus?: string;
  createdAt?: Date;
  updatedAt?: Date;
  attributes: IdentityUserAttributes;
  groups: string[];
  userMFASettingList?: string[];
};

export type CreateIdentityUserInput = {
  email: string;
  temporaryPassword?: string;
  givenName?: string;
  familyName?: string;
  groups?: string[];
};

export interface UserIdentityProvider {
  listUsers(): Promise<IdentityUser[]>;
  createUser(input: CreateIdentityUserInput): Promise<IdentityUser>;
  getUser(username: string): Promise<IdentityUser>;
  disableUser(username: string): Promise<void>;
  enableUser(username: string): Promise<void>;
  deleteUser(username: string): Promise<void>;
  addUserToGroups(username: string, groups: string[]): Promise<void>;
  removeUserFromGroups(username: string, groups: string[]): Promise<void>;
}
