import type { IdentityUser } from '@/application/ports/user-identity-provider.js';
import type { IdentityUserSyncItem } from '@/application/ports/user-repository.js';

export function toIdentityUserSyncItems(identityUsers: IdentityUser[]): IdentityUserSyncItem[] {
  return identityUsers
    .filter((user) => user.username && user.attributes?.email)
    .map((user) => ({
      username: user.username,
      email: user.attributes.email!,
    }));
}
