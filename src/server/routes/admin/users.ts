import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { requireAdmin } from '@/server/auth.js';

const log = utils.getLogger('routes/admin/users');

export function createAdminUsersRouter(config: any, db: any, cognitoAdmin: any) {
  const router = Router();

  router.get('/', requireAdmin, async (_req, res) => {
    try {
      log.info('Fetching Cognito users...');
      const cognitoUsers = await cognitoAdmin.listUsers();
      log.info(`Fetched ${cognitoUsers.length} users from Cognito`);

      const usersToSync = cognitoUsers
        .filter((u: any) => u.username && u.attributes?.email)
        .map((u: any) => ({ username: u.username, email: u.attributes.email }));

      log.info(`Syncing ${usersToSync.length} users to database`, { users: usersToSync });

      try {
        await db.syncCognitoUsers(usersToSync);
        log.info('Users synced to database successfully');
      } catch (syncErr) {
        log.error('Failed to sync users to database', { error: syncErr });
        // Don't fail the response, still return Cognito users even if sync fails
      }

      // Also get users from DB to return enriched data
      let dbUsers: any[] = [];
      try {
        dbUsers = await db.getAllUsers();
        log.info(`Fetched ${dbUsers.length} users from database`, { users: dbUsers });
      } catch (dbErr) {
        log.error('Failed to fetch users from database', { error: dbErr });
      }

      return res.json({
        cognitoUsers,
        dbUsers,
        synced: true,
      });
    } catch (err) {
      log.error('Get users failed', { error: err });
      return res.status(502).json({ error: 'List users failed' });
    }
  });

  router.post('/sync', requireAdmin, async (_req, res) => {
    log.info('Manual sync request for users');
    try {
      log.info('Fetching all users from Cognito...');
      const cognitoUsers = await cognitoAdmin.listUsers();
      log.info(`Fetched ${cognitoUsers.length} users from Cognito`, {
        users: cognitoUsers.map((u: any) => ({ username: u.username, email: u.attributes?.email })),
      });

      const usersToSync = cognitoUsers
        .filter((u: any) => u.username && u.attributes?.email)
        .map((u: any) => ({ username: u.username, email: u.attributes.email }));

      log.info(`Extracted ${usersToSync.length} users from Cognito`, { users: usersToSync });

      log.info(`Syncing to database`);
      await db.syncCognitoUsers(usersToSync);
      log.info('Sync completed successfully');

      return res.json({
        ok: true,
        count: usersToSync.length,
        users: usersToSync,
      });
    } catch (err) {
      log.error('User sync failed', { error: err, stack: err instanceof Error ? err.stack : undefined });
      return res.status(502).json({ error: 'User sync failed' });
    }
  });

  router.post('/', requireAdmin, async (req, res) => {
    const { email, groups, temporaryPassword, givenName, familyName, clientId } = req.body || {};

    console.log('Create user request', { email, groups, givenName, familyName, clientId });
    log.info('Create user request', { email, groups, givenName, familyName, clientId });

    if (!email) {
      log.warn('Create user failed: email is required');
      return res.status(400).json({
        error: 'email is required',
      });
    }

    if (groups && !Array.isArray(groups)) {
      log.warn('Create user failed: groups must be array', { groups });
      return res.status(400).json({
        error: 'groups must be an array of strings',
      });
    }

    try {
      log.info('Creating user in Cognito', { email });
      const user = await cognitoAdmin.createUser({
        email,
        temporaryPassword,
        givenName,
        familyName,
        groups,
      });
      log.info('User created in Cognito successfully', { email });

      await db.createUser(user.username, email, clientId);
      log.info('User created in database successfully', { email, clientId });

      return res.status(201).json(user);
    } catch (err) {
      log.error('Create user failed', { email, error: err, stack: err instanceof Error ? err.stack : undefined });
      return res.status(502).json({ error: 'Create user failed' });
    }
  });

  router.get('/db-users', requireAdmin, async (req, res) => {
    try {
      log.info('Fetching all users from database');
      
      const users = await db.getAllUsers();
      log.info(`Fetched ${users.length} users from database`, { users });

      return res.json({
        count: users.length,
        users,
      });
    } catch (err) {
      log.error('Get database users failed', { error: err });
      return res.status(500).json({ error: 'Failed to fetch database users' });
    }
  });

  router.get('/:username', requireAdmin, async (req, res) => {
    try {
      const user = await cognitoAdmin.getUser(req.params.username);
      return res.json(user);
    } catch (err: any) {
      log.error('Cognito get user failed', err);

      if (err?.name === 'UserNotFoundException') {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(502).json({ error: 'Get user failed' });
    }
  });

  router.post('/:username/groups', requireAdmin, async (req, res) => {
    const username = req.params.username;
    const { groups } = req.body || {};

    if (!Array.isArray(groups)) {
      return res.status(400).json({
        error: 'group must be an array',
      });
    }

    const normalizedGroups = groups.filter(
      (g: unknown): g is string => typeof g === 'string' && g.trim().length > 0
    );

    const allowedGroups = new Set(['allowed', 'admin']);

    const invalidGroups = normalizedGroups.filter((g) => !allowedGroups.has(g));
    if (invalidGroups.length > 0) {
      return res.status(400).json({
        error: `Invalid groups: ${invalidGroups.join(', ')}`,
      });
    }

    try {
      const user = await cognitoAdmin.getUser(username);
      const currentGroups = user.groups || [];

      const groupsToAdd = normalizedGroups.filter((g) => !currentGroups.includes(g));
      const groupsToRemove = currentGroups.filter((g: string) => !normalizedGroups.includes(g));

      if (groupsToAdd.length > 0) {
        await cognitoAdmin.addUserToGroups(username, groupsToAdd);
      }

      if (groupsToRemove.length > 0) {
        await cognitoAdmin.removeUserFromGroups(username, groupsToRemove);
      }

      const updatedUser = await cognitoAdmin.getUser(username);
      const dbUser = await db.getUserById(username);
      const client = dbUser?.clientId ? await db.getClient(dbUser.clientId) : null;

      return res.json({
        ...updatedUser,
        clientId: dbUser?.clientId || null,
        clientName: client?.name || null,
      });
    } catch (err) {
      log.error('Set user groups failed', err);
      return res.status(502).json({ error: 'Set user groups failed' });
    }
  });

  router.post('/:username/disable', requireAdmin, async (req, res) => {
    try {
      await cognitoAdmin.disableUser(req.params.username);
      return res.json({ ok: true, username: req.params.username, enabled: false });
    } catch (err: any) {
      log.error('Cognito disable user failed', err);

      if (err?.name === 'UserNotFoundException') {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(502).json({ error: 'Disable user failed' });
    }
  });

  router.post('/:username/enable', requireAdmin, async (req, res) => {
    try {
      await cognitoAdmin.enableUser(req.params.username);
      return res.json({ ok: true, username: req.params.username, enabled: true });
    } catch (err: any) {
      log.error('Cognito enable user failed', err);

      if (err?.name === 'UserNotFoundException') {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(502).json({ error: 'Enable user failed' });
    }
  });

  router.patch('/:username/client', requireAdmin, async (req, res) => {
    const username = req.params.username;
    const { clientId } = req.body || "VACIO";

    console.log('Patch user client request', { username, clientId });
    log.info('Patch user client request', { username, clientId });

    if (clientId !== null && clientId !== undefined && typeof clientId !== 'string') {
      return res.status(400).json({ error: 'clientId must be a string or null' });
    }

    try {
      const user = await db.getUserById(username);

      if (!user) {
        return res.status(404).json({ error: 'User not found in database' });
      }

      if (clientId) {
        await db.updateUserClient(user.id, clientId);

        return res.json({
          ok: true,
          username,
          userId: user.id,
          email: user.email,
          clientId,
          clientName: null,
        });
      }

      await db.updateUserClient(user.id, null as any);

      return res.json({
        ok: true,
        username,
        userId: user.id,
        email: user.email,
        clientId: null,
        clientName: null,
      });
    } catch (err) {
      log.error('Update user client failed', { username, clientId, error: err });
      return res.status(500).json({ error: 'Update user client failed' });
    }
  });

  router.delete('/:username', requireAdmin, async (req, res) => {
    const username = req.params.username;

    if (req.session.user?.email === username) {
      return res.status(400).json({
        error: 'cannot_delete_self'
      });
    }

    try {
      await cognitoAdmin.deleteUser(username);

      await db.deleteUser(username);

      return res.json({ ok: true, username });
    } catch (err) {
      log.error('Delete user failed', err);
      return res.status(502).json({ error: 'Delete user failed' })
    }
  })

  router.get('/by-client/:clientName', requireAdmin, async (req, res) => {
    const clientName = req.params.clientName;

    try {
      const client = await db.getClientByName(clientName);

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const users = await db.getUsersByClient(client.id);

      return res.json({
        clientId: client.id,
        clientName: client.name,
        users,
      });
    } catch (err) {
      log.error('Get users for client failed', err);
      return res.status(500).json({ error: 'Get users for client failed' });
    }
  });

  return router;
}
