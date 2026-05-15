import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '@/server/app.js';

const mockDb = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getAllUsers: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  getUsersByClient: vi.fn(),
  syncCognitoUsers: vi.fn(),
  updateUserClient: vi.fn(),
}));

const mockCognitoAdmin = vi.hoisted(() => ({
  addUserToGroups: vi.fn(),
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  getUser: vi.fn(),
  listUsers: vi.fn(),
  removeUserFromGroups: vi.fn(),
}));

vi.mock('@/server/db.js', () => ({
  createDb: () => mockDb,
}));

vi.mock('@/server/cognito-admin.js', () => ({
  createCognitoAdminService: () => mockCognitoAdmin,
}));

vi.mock('@/server/auth.js', () => ({
  login: vi.fn(),
  requireLogin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'u1', email: 'admin@example.com', admin: true };
    next();
  },
  requireAdmin: (req: any, _res: any, next: any) => {
    req.session ||= {};
    req.session.user = { _id: 'admin1', email: 'admin@example.com', admin: true };
    next();
  },
}));

vi.mock('@/server/collector.js', () => ({
  createCollector: () => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    refreshRobots: vi.fn(),
    getStatus: vi.fn(),
  }),
  getCollector: vi.fn(() => null),
}));

describe('Admin users', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /admin/users syncs Cognito users and returns database users', async () => {
    const cognitoUsers = [
      { username: 'user-1', attributes: { email: 'one@example.com' } },
      { username: 'user-2', attributes: {} },
    ];
    const dbUsers = [
      { id: 'user-1', email: 'one@example.com', clientId: null },
    ];

    (mockCognitoAdmin.listUsers as any).mockResolvedValue(cognitoUsers);
    (mockDb.syncCognitoUsers as any).mockResolvedValue(undefined);
    (mockDb.getAllUsers as any).mockResolvedValue(dbUsers);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .get('/admin/users')
      .expect(200);

    expect(mockDb.syncCognitoUsers).toHaveBeenCalledWith([
      { username: 'user-1', email: 'one@example.com' },
    ]);
    expect(res.body).toEqual({
      cognitoUsers,
      dbUsers,
      synced: true,
    });
  });

  it('POST /admin/users/sync manually syncs Cognito users', async () => {
    (mockCognitoAdmin.listUsers as any).mockResolvedValue([
      { username: 'user-1', attributes: { email: 'one@example.com' } },
    ]);
    (mockDb.syncCognitoUsers as any).mockResolvedValue(undefined);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .post('/admin/users/sync')
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      count: 1,
      users: [{ username: 'user-1', email: 'one@example.com' }],
    });
  });

  it('POST /admin/users creates Cognito and database users', async () => {
    const cognitoUser = {
      username: 'user-1',
      attributes: { email: 'one@example.com' },
    };

    (mockCognitoAdmin.createUser as any).mockResolvedValue(cognitoUser);
    (mockDb.createUser as any).mockResolvedValue('user-1');

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .post('/admin/users')
      .send({
        email: '  ONE@EXAMPLE.COM  ',
        groups: ['allowed'],
        temporaryPassword: 'Temp123!',
        givenName: 'One',
        familyName: 'Example',
        clientId: 'client-1',
      })
      .expect(201);

    expect(mockCognitoAdmin.createUser).toHaveBeenCalledWith({
      email: '  ONE@EXAMPLE.COM  ',
      temporaryPassword: 'Temp123!',
      givenName: 'One',
      familyName: 'Example',
      groups: ['allowed'],
    });
    expect(mockDb.createUser).toHaveBeenCalledWith(
      'user-1',
      'one@example.com',
      'client-1'
    );
    expect(res.body).toEqual(cognitoUser);
  });

  it('GET /admin/users/db-users returns database users', async () => {
    const users = [
      { id: 'user-1', email: 'one@example.com', clientId: null },
    ];

    (mockDb.getAllUsers as any).mockResolvedValue(users);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .get('/admin/users/db-users')
      .expect(200);

    expect(res.body).toEqual({
      count: 1,
      users,
    });
  });

  it('PATCH /admin/users/:username/client updates the local user client', async () => {
    (mockDb.getUserById as any).mockResolvedValue({
      id: 'user-1',
      email: 'one@example.com',
      clientId: null,
    });
    (mockDb.updateUserClient as any).mockResolvedValue(undefined);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .patch('/admin/users/user-1/client')
      .send({ clientId: 'client-1' })
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      username: 'user-1',
      userId: 'user-1',
      email: 'one@example.com',
      clientId: 'client-1',
      clientName: null,
    });
    expect(mockDb.updateUserClient).toHaveBeenCalledWith('user-1', 'client-1');
  });

  it('PATCH /admin/users/:username/client returns 404 for a missing local user', async () => {
    (mockDb.getUserById as any).mockResolvedValue(null);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .patch('/admin/users/missing/client')
      .send({ clientId: 'client-1' })
      .expect(404);

    expect(res.body.error).toBe('User not found in database');
    expect(mockDb.updateUserClient).not.toHaveBeenCalled();
  });

  it('DELETE /admin/users/:username deletes Cognito and database users', async () => {
    (mockCognitoAdmin.deleteUser as any).mockResolvedValue(undefined);
    (mockDb.deleteUser as any).mockResolvedValue(undefined);

    const app = createApp({
      oidcClient: { authorizationUrl: () => 'http://example/redirect' } as any,
    });

    const res = await request(app)
      .delete('/admin/users/user-1')
      .expect(200);

    expect(res.body).toEqual({
      ok: true,
      username: 'user-1',
    });
    expect(mockCognitoAdmin.deleteUser).toHaveBeenCalledWith('user-1');
    expect(mockDb.deleteUser).toHaveBeenCalledWith('user-1');
  });
});
