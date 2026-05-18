import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { ClientNotFoundError } from '@/application/use-cases/clients/errors.js';
import type { CreateIdentityUserAndLocalUser } from '@/application/use-cases/users/create-identity-user-and-local-user.js';
import type { DeleteIdentityUserAndLocalUser } from '@/application/use-cases/users/delete-identity-user-and-local-user.js';
import { UserNotFoundError, UserValidationError } from '@/application/use-cases/users/errors.js';
import type { GetIdentityUser } from '@/application/use-cases/users/get-identity-user.js';
import type { ListUsers } from '@/application/use-cases/users/list-users.js';
import type { ListUsersForClientByName } from '@/application/use-cases/users/list-users-for-client-by-name.js';
import type { ListUsersWithIdentitySync } from '@/application/use-cases/users/list-users-with-identity-sync.js';
import type { SetIdentityUserEnabled } from '@/application/use-cases/users/set-identity-user-enabled.js';
import type { SyncIdentityUsersFromProvider } from '@/application/use-cases/users/sync-identity-users-from-provider.js';
import type { UpdateIdentityUserGroups } from '@/application/use-cases/users/update-identity-user-groups.js';
import type { UpdateUserClient } from '@/application/use-cases/users/update-user-client.js';
import { requireAdmin } from '@/server/auth.js';

const log = utils.getLogger('routes/admin/users');

export type AdminUsersRouterDeps = {
  createIdentityUserAndLocalUser: CreateIdentityUserAndLocalUser;
  deleteIdentityUserAndLocalUser: DeleteIdentityUserAndLocalUser;
  getIdentityUser: GetIdentityUser;
  listUsers: ListUsers;
  listUsersForClientByName: ListUsersForClientByName;
  listUsersWithIdentitySync: ListUsersWithIdentitySync;
  setIdentityUserEnabled: SetIdentityUserEnabled;
  syncIdentityUsersFromProvider: SyncIdentityUsersFromProvider;
  updateIdentityUserGroups: UpdateIdentityUserGroups;
  updateUserClient: UpdateUserClient;
};

export function createAdminUsersRouter(deps: AdminUsersRouterDeps) {
  const router = Router();

  router.get('/', requireAdmin, async (_req, res) => {
    /**
     * @swagger
     * /admin/users:
     *   get:
     *     summary: List all users from the identity provider and database
     *     description: Fetches all users from the identity provider, syncs them with the database, and returns both lists
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
     *                 identityUsers:
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
     *         description: Error fetching users from the identity provider
     */
    try {
      const result = await deps.listUsersWithIdentitySync.execute();
      return res.json(result);
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
     *     summary: Manually sync users from the identity provider to database
     *     description: Fetches all users from the identity provider and synchronizes them with the database
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
      const result = await deps.syncIdentityUsersFromProvider.execute();

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
     *     description: Creates a new user in the identity provider and stores them in the database
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
     *         description: Identity provider operation failed
     */
    const { email, groups, temporaryPassword, givenName, familyName, clientId } = req.body || {};

    log.info('Create user request', { email, groups, givenName, familyName, clientId });

    try {
      const user = await deps.createIdentityUserAndLocalUser.execute({
        email,
        temporaryPassword,
        givenName,
        familyName,
        groups,
        clientId,
      });

      return res.status(201).json(user);
    } catch (err) {
      if (err instanceof UserValidationError) {
        return res.status(400).json({ error: err.message });
      }

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
      
      const users = await deps.listUsers.execute();
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
     *     description: Retrieves information about a specific user from the identity provider
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
     *         description: Identity provider operation failed
     */
    try {
      const user = await deps.getIdentityUser.execute(req.params.username);
      return res.json(user);
    } catch (err) {
      log.error('Identity provider get user failed', err);

      if (err instanceof UserNotFoundError) {
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
     *         description: Identity provider operation failed
     */
    const username = req.params.username;
    const { groups } = req.body || {};

    try {
      const result = await deps.updateIdentityUserGroups.execute({ username, groups });
      return res.json(result);
    } catch (err) {
      if (err instanceof UserValidationError) {
        return res.status(400).json({ error: err.message });
      }

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
     *     description: Disables a user account in the identity provider
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
     *         description: Identity provider operation failed
     */
    try {
      const result = await deps.setIdentityUserEnabled.execute({
        username: req.params.username,
        enabled: false,
      });

      return res.json(result);
    } catch (err) {
      log.error('Identity provider disable user failed', err);

      if (err instanceof UserNotFoundError) {
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
     *     description: Enables a disabled user account in the identity provider
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
     *         description: Identity provider operation failed
     */
    try {
      const result = await deps.setIdentityUserEnabled.execute({
        username: req.params.username,
        enabled: true,
      });

      return res.json(result);
    } catch (err) {
      log.error('Identity provider enable user failed', err);

      if (err instanceof UserNotFoundError) {
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
    const { clientId } = req.body || {};

    log.info('Patch user client request', { username, clientId });

    if (clientId !== null && clientId !== undefined && typeof clientId !== 'string') {
      return res.status(400).json({ error: 'clientId must be a string or null' });
    }

    try {
      const user = await deps.updateUserClient.execute({
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
     *     description: Deletes a user from the identity provider and database. Cannot delete your own account
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
     *         description: Identity provider operation failed
     */
    const username = req.params.username;

    try {
      await deps.deleteIdentityUserAndLocalUser.execute({
        username,
        currentUserId: req.session.user?._id,
      });

      return res.json({ ok: true, username });
    } catch (err) {
      if (err instanceof UserValidationError) {
        return res.status(400).json({ error: err.message });
      }

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
      const result = await deps.listUsersForClientByName.execute(clientName);
      return res.json(result);
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
