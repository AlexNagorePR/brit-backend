import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import type {
  CreateIdentityUserInput,
  IdentityUser,
  UserIdentityProvider,
} from '@/application/ports/user-identity-provider.js';

export function createCognitoUserIdentityProvider(opts: {
  region: string;
  userPoolId: string;
}): UserIdentityProvider {
  const client = new CognitoIdentityProviderClient({
    region: opts.region,
  });
  const userPoolId = opts.userPoolId;

  async function listGroupsForUser(username: string): Promise<string[]> {
    const res = await client.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      })
    );

    return (res.Groups || [])
      .map((group) => group.GroupName)
      .filter((group): group is string => Boolean(group));
  }

  return {
    async listUsers(): Promise<IdentityUser[]> {
      const out = await client.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
        })
      );

      const users = out.Users || [];

      return Promise.all(
        users.map(async (user) => {
          const mapped = mapUser(user);
          const groups = mapped.username
            ? await listGroupsForUser(mapped.username)
            : [];

          return {
            ...mapped,
            groups,
          };
        })
      );
    },

    async addUserToGroups(username: string, groups: string[]): Promise<void> {
      for (const group of groups) {
        await client.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: username,
            GroupName: group,
          })
        );
      }
    },

    async removeUserFromGroups(username: string, groups: string[]): Promise<void> {
      for (const group of groups) {
        await client.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: userPoolId,
            Username: username,
            GroupName: group,
          })
        );
      }
    },

    async createUser(input: CreateIdentityUserInput): Promise<IdentityUser> {
      const out = await client.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: input.email,
          TemporaryPassword: input.temporaryPassword,
          UserAttributes: [
            { Name: 'email', Value: input.email },
            { Name: 'email_verified', Value: 'true' },
            ...(input.givenName ? [{ Name: 'given_name', Value: input.givenName }] : []),
            ...(input.familyName ? [{ Name: 'family_name', Value: input.familyName }] : []),
          ],
        })
      );

      const groups = input.groups || [];
      const username = out.User?.Username || input.email;

      for (const group of groups) {
        await client.send(
          new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: username,
            GroupName: group,
          })
        );
      }

      return {
        ...mapUser(out.User),
        username,
        groups,
      };
    },

    async getUser(username: string): Promise<IdentityUser> {
      const out = await client.send(
        new AdminGetUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        })
      );

      const attributes = Object.fromEntries(
        (out.UserAttributes || []).map((attribute) => [attribute.Name!, attribute.Value])
      );
      const groups = await listGroupsForUser(username);

      return {
        username: out.Username || username,
        enabled: out.Enabled,
        userStatus: out.UserStatus,
        attributes,
        groups,
        userMFASettingList: out.UserMFASettingList || [],
      };
    },

    async deleteUser(username: string): Promise<void> {
      await client.send(
        new AdminDeleteUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        })
      );
    },

    async disableUser(username: string): Promise<void> {
      await client.send(
        new AdminDisableUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        })
      );
    },

    async enableUser(username: string): Promise<void> {
      await client.send(
        new AdminEnableUserCommand({
          UserPoolId: userPoolId,
          Username: username,
        })
      );
    },
  };
}

function mapUser(user?: UserType): Omit<IdentityUser, 'groups' | 'userMFASettingList'> {
  const attributes = Object.fromEntries(
    (user?.Attributes || []).map((attribute) => [attribute.Name!, attribute.Value])
  );

  return {
    username: user?.Username || '',
    enabled: user?.Enabled,
    userStatus: user?.UserStatus,
    createdAt: user?.UserCreateDate,
    updatedAt: user?.UserLastModifiedDate,
    attributes,
  };
}
