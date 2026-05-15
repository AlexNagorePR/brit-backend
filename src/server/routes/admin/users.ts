import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { ClientNotFoundError } from '@/application/use-cases/clients/errors.js';
import { FindClientById } from '@/application/use-cases/clients/find-client-by-id.js';
import { FindClientByName } from '@/application/use-cases/clients/find-client-by-name.js';
import { CreateUser } from '@/application/use-cases/users/create-user.js';
import { DeleteUser } from '@/application/use-cases/users/delete-user.js';
import { UserNotFoundError } from '@/application/use-cases/users/errors.js';
import { FindUserById } from '@/application/use-cases/users/find-user-by-id.js';
import { ListUsers } from '@/application/use-cases/users/list-users.js';
import { ListUsersByClient } from '@/application/use-cases/users/list-users-by-client.js';
import { SyncCognitoUsers } from '@/application/use-cases/users/sync-cognito-users.js';
import { UpdateUserClient } from '@/application/use-cases/users/update-user-client.js';
import { createDbClientRepository } from '@/infrastructure/db/client-repository.js';
import { createDbUserRepository } from '@/infrastructure/db/user-repository.js';
import { requireAdmin } from '@/server/auth.js';

const log = utils.getLogger('routes/admin/users');

export function createAdminUsersRouter(config: any, db: any, cognitoAdmin: any) {
  const router = Router();
  const clientRepository = createDbClientRepository(db);
  const findClientById = new FindClientById(clientRepository);
  const findClientByName = new FindClientByName(clientRepository);
  const userRepository = createDbUserRepository(db);
  const createUser = new CreateUser(userRepository);
  const deleteUser = new DeleteUser(userRepository);
  const findUserById = new FindUserById(userRepository);
  const listUsers = new ListUsers(userRepository);
  const listUsersByClient = new ListUsersByClient(userRepository);
  const syncCognitoUsers = new SyncCognitoUsers(userRepository);
  const updateUserClient = new UpdateUserClient(userRepository);

  router.get('/', requireAdmin, async (_req, res) => {
    /**
     * @swagger
     * /admin/users:
     *   get:
     *     summary: List all users from Cognito and database
     *     description: Fetches all users from Cognito, syncs them with the database, and returns both lists
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     responses:
     *       200:
     *         description: Users retrieved and synced successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 cognitoUsers:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       username:
     *                         type: string
     *                         example: "user@example.com"
     *                       enabled:
     *                         type: boolean
     *                       groups:
     *                         type: array
     *                         items:
     *                           type: string
     *                 dbUsers:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       id:
     *                         type: string
     *                       email:
     *                         type: string
     *                       clientId:
     *                         type: string
     *                         nullable: true
     *                 synced:
     *                   type: boolean
     *       401:
     *         description: User not authenticated or not admin
     *       502:
     *         description: Error fetching users from Cognito
     */
    try {
      log.info('Fetching Cognito users...');
      const cognitoUsers = await cognitoAdmin.listUsers();
      log.info(`Fetched ${cognitoUsers.length} users from Cognito`);

      const usersToSync = cognitoUsers
        .filter((u: any) => u.username && u.attributes?.email)
        .map((u: any) => ({ username: u.username, email: u.attributes.email }));

      log.info(`Syncing ${usersToSync.length} users to database`, { users: usersToSync });

      try {
        await syncCognitoUsers.execute(usersToSync);
        log.info('Users synced to database successfully');
      } catch (syncErr) {
        log.error('Failed to sync users to database', { error: syncErr });
        // Don't fail the response, still return Cognito users even if sync fails
      }

      // Also get users from DB to return enriched data
      let dbUsers: any[] = [];
      try {
        dbUsers = await listUsers.execute();
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
    /**
     * @swagger
     * /admin/users/sync:
     *   post:
     *     summary: Manually sync users from Cognito to database
     *     description: Fetches all users from Cognito and synchronizes them with the database
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     responses:
     *       200:
     *         description: Users synced successfully
     *       401:
     *         description: User not authenticated or not admin
     *       502:
     *         description: Sync failed
     */
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
      const result = await syncCognitoUsers.execute(usersToSync);
      log.info('Sync completed successfully');

      return res.json({
        ok: true,
        count: result.count,
        users: result.users,
      });
    } catch (err) {
      log.error('User sync failed', { error: err, stack: err instanceof Error ? err.stack : undefined });
      return res.status(502).json({ error: 'User sync failed' });
    }
  });

  router.post('/', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/users:
     *   post:
     *     summary: Create a new user
     *     description: Creates a new user in Cognito and stores them in the database
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *               givenName:
     *                 type: string
     *               familyName:
     *                 type: string
     *               groups:
     *                 type: array
     *                 items:
     *                   type: string
     *               clientId:
     *                 type: string
     *     responses:
     *       201:
     *         description: User created successfully
     *       400:
     *         description: Missing email or invalid groups
     *       401:
     *         description: User not authenticated or not admin
     *       502:
     *         description: Cognito operation failed
     */
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

      await createUser.execute({
        id: user.username,
        email,
        clientId,
      });
      log.info('User created in database successfully', { email, clientId });

      return res.status(201).json(user);
    } catch (err) {
      log.error('Create user failed', { email, error: err, stack: err instanceof Error ? err.stack : undefined });
      return res.status(502).json({ error: 'Create user failed' });
    }
  });

  router.get('/db-users', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/users/db-users:
     *   get:
     *     summary: Get all users from database
     *     description: Returns only users stored in the local database
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     responses:
     *       200:
     *         description: Database users retrieved successfully
     *       401:
     *         description: User not authenticated or not admin
     *       500:
     *         description: Database error
     */
    try {
      log.info('Fetching all users from database');
      
      const users = await listUsers.execute();
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
    /**
     * @swagger
     * /admin/users/{username}:
     *   get:
     *     summary: Get user by username
     *     description: Retrieves information about a specific user from Cognito
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: username
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: User retrieved successfully
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: User not found
     *       502:
     *         description: Cognito operation failed
     */
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
    /**
     * @swagger
     * /admin/users/{username}/groups:
     *   post:
     *     summary: Set user groups
     *     description: Updates the groups for a user (allowed, admin)
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: username
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               groups:
     *                 type: array
     *                 items:
     *                   type: string
     *     responses:
     *       200:
     *         description: User groups updated successfully
     *       400:
     *         description: Groups must be array or invalid group names
     *       401:
     *         description: User not authenticated or not admin
     *       502:
     *         description: Cognito operation failed
     */
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
      const dbUser = await findUserById.execute(username);
      const client = dbUser?.clientId ? await findClientById.execute(dbUser.clientId) : null;

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
    /**
     * @swagger
     * /admin/users/{username}/disable:
     *   post:
     *     summary: Disable a user
     *     description: Disables a user account in Cognito
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: username
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: User disabled successfully
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: User not found
     *       502:
     *         description: Cognito operation failed
     */
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
    /**
     * @swagger
     * /admin/users/{username}/enable:
     *   post:
     *     summary: Enable a user
     *     description: Enables a disabled user account in Cognito
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: username
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: User enabled successfully
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: User not found
     *       502:
     *         description: Cognito operation failed
     */
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
    /**
     * @swagger
     * /admin/users/{username}/client:
     *   patch:
     *     summary: Assign or remove client for user
     *     description: Associates a user with a client or removes the association
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: username
     *         required: true
     *         schema:
     *           type: string
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               clientId:
     *                 type: string
     *                 nullable: true
     *     responses:
     *       200:
     *         description: User client assignment updated successfully
     *       400:
     *         description: clientId must be string or null
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: User not found in database
     *       500:
     *         description: Update failed
     */
    const username = req.params.username;
    const { clientId } = req.body || "VACIO";

    console.log('Patch user client request', { username, clientId });
    log.info('Patch user client request', { username, clientId });

    if (clientId !== null && clientId !== undefined && typeof clientId !== 'string') {
      return res.status(400).json({ error: 'clientId must be a string or null' });
    }

    try {
      const user = await updateUserClient.execute({
        userId: username,
        clientId,
      });

      return res.json({
        ok: true,
        username,
        userId: user.id,
        email: user.email,
        clientId: user.clientId,
        clientName: null,
      });
    } catch (err) {
      if (err instanceof UserNotFoundError) {
        return res.status(404).json({ error: 'User not found in database' });
      }

      log.error('Update user client failed', { username, clientId, error: err });
      return res.status(500).json({ error: 'Update user client failed' });
    }
  });

  router.delete('/:username', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/users/{username}:
     *   delete:
     *     summary: Delete a user
     *     description: Deletes a user from Cognito and database. Cannot delete your own account
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: username
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: User deleted successfully
     *       400:
     *         description: Cannot delete your own account
     *       401:
     *         description: User not authenticated or not admin
     *       502:
     *         description: Cognito operation failed
     */
    const username = req.params.username;

    if (req.session.user?.email === username) {
      return res.status(400).json({
        error: 'cannot_delete_self'
      });
    }

    try {
      await cognitoAdmin.deleteUser(username);

      await deleteUser.execute(username);

      return res.json({ ok: true, username });
    } catch (err) {
      log.error('Delete user failed', err);
      return res.status(502).json({ error: 'Delete user failed' })
    }
  })

  router.get('/by-client/:clientName', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/users/by-client/{clientName}:
     *   get:
     *     summary: Get all users for a specific client
     *     description: Returns all users assigned to a particular client
     *     tags:
     *       - Admin - Users
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: clientName
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Users retrieved successfully
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: Client not found
     *       500:
     *         description: Query failed
     */
    const clientName = req.params.clientName;

    try {
      const client = await findClientByName.execute(clientName);

      const users = await listUsersByClient.execute(client.id);

      return res.json({
        clientId: client.id,
        clientName: client.name,
        users,
      });
    } catch (err) {
      if (err instanceof ClientNotFoundError) {
        return res.status(404).json({ error: err.message });
      }

      log.error('Get users for client failed', err);
      return res.status(500).json({ error: 'Get users for client failed' });
    }
  });

  return router;
}
