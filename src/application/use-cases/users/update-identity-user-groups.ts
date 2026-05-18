import type { IdentityUser, UserIdentityProvider } from '@/application/ports/user-identity-provider.js';
import { FindClientById } from '@/application/use-cases/clients/find-client-by-id.js';
import { FindUserById } from './find-user-by-id.js';
import { UserValidationError } from './errors.js';

export type UpdateIdentityUserGroupsCommand = {
  username: string;
  groups: unknown;
};

export type UpdateIdentityUserGroupsResult = IdentityUser & {
  clientId: string | null;
  clientName: string | null;
};

const ALLOWED_GROUPS = new Set(['allowed', 'admin']);

export class UpdateIdentityUserGroups {
  constructor(
    private readonly userIdentityProvider: UserIdentityProvider,
    private readonly findUserById: FindUserById,
    private readonly findClientById: FindClientById
  ) {}

  async execute(command: UpdateIdentityUserGroupsCommand): Promise<UpdateIdentityUserGroupsResult> {
    if (!Array.isArray(command.groups)) {
      throw new UserValidationError('group must be an array');
    }

    const groups = command.groups.filter(
      (group: unknown): group is string => typeof group === 'string' && group.trim().length > 0
    );

    const invalidGroups = groups.filter((group) => !ALLOWED_GROUPS.has(group));
    if (invalidGroups.length > 0) {
      throw new UserValidationError(`Invalid groups: ${invalidGroups.join(', ')}`);
    }

    const user = await this.userIdentityProvider.getUser(command.username);
    const currentGroups = user.groups || [];

    const groupsToAdd = groups.filter((group) => !currentGroups.includes(group));
    const groupsToRemove = currentGroups.filter((group) => !groups.includes(group));

    if (groupsToAdd.length > 0) {
      await this.userIdentityProvider.addUserToGroups(command.username, groupsToAdd);
    }

    if (groupsToRemove.length > 0) {
      await this.userIdentityProvider.removeUserFromGroups(command.username, groupsToRemove);
    }

    const updatedUser = await this.userIdentityProvider.getUser(command.username);
    const dbUser = await this.findUserById.execute(command.username);
    const client = dbUser?.clientId ? await this.findClientById.execute(dbUser.clientId) : null;

    return {
      ...updatedUser,
      clientId: dbUser?.clientId || null,
      clientName: client?.name || null,
    };
  }
}
