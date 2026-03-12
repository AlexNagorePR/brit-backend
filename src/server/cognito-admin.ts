import {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    AdminCreateUserCommand,
    AdminGetUserCommand,
    AdminDisableUserCommand,
    AdminEnableUserCommand,
    AdminAddUserToGroupCommand,
    AdminRemoveUserFromGroupCommand,
    AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export type CognitoAdminService = {
    listUsers(): Promise<any[]>;
    createUser(input: {
        email: string,
        temporaryPassword?: string;
        givenName?: string;
        familyName?: string;
        groups?: string[];
    }): Promise<any>;
    getUser(username: string): Promise<any>;
    disableUser(username: string): Promise<any>;
    enableUser(username: string): Promise<any>;
    addUserToGroups(username: string, groups: string[]): Promise<void>;
    removeUserFromGroups(username: string, groups: string[]): Promise<void>;
};

function mapUser(user: any) {
    const attrs = Object.fromEntries(
        (user.Attributes || []).map((a: any) => [a.Name, a.Value])
    );

    return {
        username: user.Username,
        enabled: user.Enabled,
        userStatus: user.UserStatus,
        createdAt: user.UserCreateDate,
        updatedAt: user.UserLastModifiedDate,
        attributes: attrs,
    };
}


export function createCognitoAdminService(opts: {
    region: string;
    userPoolId: string;
}): CognitoAdminService {
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
            .map((g) => g.GroupName)
            .filter((g): g is string => Boolean(g));
    }

    return {
        async listUsers() {
            const out = await client.send(
                new ListUsersCommand({
                    UserPoolId: userPoolId,
                })
            );
            
            const users = out.Users || [];

            return Promise.all(
                users.map(async (u) => {
                    const mapped = mapUser(u);
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

        async addUserToGroups(username, groups) {
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

        async removeUserFromGroups(username, groups) {
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

        async createUser(input) {
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

            console.log('groups to add:', input);
            const groups = input.groups || [];


            for (const group of groups) {
                console.log('adding user to group:', input.email, group);
                await client.send(
                    new AdminAddUserToGroupCommand({
                        UserPoolId: userPoolId,
                        Username: out.User?.Username,
                        GroupName: group,
                    })
                );

                console.log('added to group:', group);
            }

            const baseUser = out.User ? mapUser(out.User) : null;

            return {
                ...baseUser,
                groups,
            };
        },

        async getUser(username) {
            const out = await client.send(
                new AdminGetUserCommand({
                    UserPoolId: userPoolId,
                    Username: username,
                })
            );

            const attr = Object.fromEntries(
                (out.UserAttributes || []).map((a) => [a.Name!, a.Value])
            );

            const groups = await listGroupsForUser(username);

            return {
                username: out.Username,
                enabled: out.Enabled,
                userStatus: out.UserStatus,
                attributes: attr,
                groups,
                userMFASettingList: out.UserMFASettingList || [],
            };
        },

        async disableUser(username) {
            await client.send(
                new AdminDisableUserCommand({
                    UserPoolId: userPoolId,
                    Username: username,
                })
            );
        },

        async enableUser(username) {
            await client.send(
                new AdminEnableUserCommand({
                    UserPoolId: userPoolId,
                    Username: username,
                })
            );
        },
    }
}
