// src/server/app.ts
import express from 'express';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import path from 'path';
import fs from 'node:fs';

import utils from '@transitive-sdk/utils';
import { loadConfig } from '@/server/config.js';
import { login, requireAdmin, requireLogin } from '@/server/auth.js';
import { signPortalApiJWT, fetchPortalApi } from '@/server/portal.js';
import { createDb, RobotInfo } from '@/server/db.js';
import { generators } from 'openid-client';
import { getTelemetryData, subscribeTelemetry } from '@/server/telemetry.js';
import { createCognitoAdminService } from './cognito-admin.js';
import {
  getHealthMonitoringSnapshot
} from '@/server/health-monitoring.js';
import { createCollector, getCollector } from '@/server/collector.js';

const log = utils.getLogger('app');
const FileStore = FileStoreFactory(session);

const defaultClientId = "00544dc1-fd10-4a48-a34a-7f1f75a383e2";

type OidcClientLike = {
  authorizationUrl(args: any): string;
  callbackParams(req: any): any;
  callback(redirectUri: string, params: any, checks: any): Promise<{ claims(): any }>;
};

export function createApp(deps: { oidcClient?: OidcClientLike } = {}) {
  const config = loadConfig();
  const { oidcClient } = deps;

  const app = express();
  app.use(express.json());

  const isProd = config.nodeEnv === 'production';

  const sessionsDir = path.join(config.varDir, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const fileStore = new FileStore({
    path: sessionsDir,
    retries: 0,
  });

  const db = createDb(config.databaseUrl);

  const collector = createCollector({
    db,
    jwtSecret: config.jwtSecret,
    transitiveUser: config.transitiveUser,
  });

  collector.start().catch(err => log.error('Collector failed to start', err));

  const cognitoAdmin = createCognitoAdminService({
    region: config.cognitoRegion,
    userPoolId: config.cognitoUserPoolId,
  });

  app.use(
    session({
      name: 'connect.sid',
      store: fileStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: isProd,
      cookie: {
        maxAge: 3 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: isProd ? 'lax' : 'lax',
        secure: isProd,
      },
    })
  );

  // Basic auth status
  app.get('/api/user', (req: any, res) => {
    const user = req.session?.user;
    return res.json({
      isAuthenticated: Boolean(user && user._id),
      userInfo: user || null,
    });
  });

  // OIDC login
  app.get('/auth/login', (req: any, res) => {
    if (!oidcClient) return res.status(500).send('OIDC client not initialized');

    const nonce = generators.nonce();
    const state = generators.state();

    req.session.oidc ||= {};
    req.session.oidc.pending ||= {};
    req.session.oidc.pending[state] = { nonce, ts: Date.now() };

    const authUrl = oidcClient.authorizationUrl({
      scope: 'email openid phone',
      state,
      nonce,
    });

    return res.redirect(authUrl);
  });

  // OIDC callback
  app.get('/auth/callback', async (req: any, res) => {
    try {
      if (!oidcClient) return res.status(500).send('OIDC client not initialized');

      if (req.query?.error) {
        log.error('OIDC error on callback', req.query);
        return res.status(400).send(`OIDC error: ${req.query.error}`);
      }

      const params = oidcClient.callbackParams(req);
      const returnedState = params.state;

      const pending = req.session?.oidc?.pending?.[returnedState];
      if (!pending) {
        log.warn('OIDC callback with unknown/expired state', { returnedState });
        return res.status(400).send('Invalid/expired state. Please try again.');
      }

      const OIDC_STATE_TTL_MS = 10 * 60 * 1000;
      if (Date.now() - pending.ts > OIDC_STATE_TTL_MS) {
        if (req.session?.oidc?.pending) delete req.session.oidc.pending[returnedState];
        return res.status(400).send('Login expired. Please try again.');
      }

      if (req.session?.oidc?.pending) delete req.session.oidc!.pending![returnedState];

      const tokenSet = await oidcClient.callback(
        config.cognitoRedirectUri,
        params,
        { nonce: pending.nonce, state: returnedState }
      );

      const claims = tokenSet.claims();
      const groups: string[] = (claims['cognito:groups'] as string[]) || [];

      if (!groups.includes('allowed')) {
        return req.session.destroy(() => {
          res.clearCookie('connect.sid');
          return res.redirect(`${config.postLoginRedirectUrl}?error=not_allowed`)
        });
      }

      const email = claims.email as string;
      const userId = email || (claims.sub as string);

      const accountLike = {
        _id: userId,
        email: email || '',
        admin: groups.includes('admin'),
        verified: true,
        created: new Date(),
      };

      return login(req, res, { account: accountLike, redirect: config.postLoginRedirectUrl });
    } catch (err: any) {
      if (res.headersSent) {
        log.error('Callback error after headers sent', err);
        return;
      }
      log.error('Callback error', err);
      return res.status(500).send(`Callback error: ${err?.message || err}`);
    }
  });

  // Logout
  app.get('/auth/logout', (req: any, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      const url =
        `https://${config.cognitoDomain}/logout` +
        `?client_id=${encodeURIComponent(config.cognitoClientId)}` +
        `&logout_uri=${encodeURIComponent(config.cognitoLogoutUri)}`;
      return res.redirect(url);
    });
  });

  // Get a JWT token for the current user
  app.post('/api/getJWT', requireLogin, (req: any, res: any) => {
    req.body.capability ||= 'ignore';

    if (req.body.capability.endsWith('_robot-agent')) {
      const msg = 'We do not sign agent tokens. But capability tokens provide read-access.';
      log.warn(msg);
      return res.status(400).send(msg);
    }

    const token = jwt.sign(
      {
        ...req.body,
        id: config.transitiveUser,
        userId: req.session.user!._id,
        validity: 86400,
      },
      config.jwtSecret
    );

    return res.json({ token });
  });

  app.get('/api/health', (_req, res) => {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/health-monitoring/:deviceId', requireLogin, async (req, res) => {
    const deviceId = req.params.deviceId;

    const data = getHealthMonitoringSnapshot(deviceId);

    return res.json({
      ok: true,
      data,
    });
  });

  app.get('/api/devices', requireLogin, async (req, res) => {
    const userEmail = req.session.user!.email!;

    console.log('Fetching devices for user', userEmail);

    let robots: RobotInfo[];
    try {
      robots = await db.getRobotIdsForUser(userEmail);
    } catch (err) {
      log.error('DB failed on /api/devices', err);
      return res.status(500).json({ error: 'Devices failed' });
    }

    try {
      const token = signPortalApiJWT({
        jwtSecret: config.jwtSecret,
        transitiveUser: config.transitiveUser,
        validitySeconds: 60,
      });

      const robotsRunning = await fetchPortalApi<any>(token, 'https://portal.transitiverobotics.com/@transitive-robotics/_robot-agent/api/v1/running/', { timeoutMs: 14000 })
      const runningIds = new Set(Object.keys(robotsRunning || {}));

      const runningRobots = robots.filter((robot) => runningIds.has(robot.id));

      const results = await Promise.all(
        runningRobots.map(async (robot) => {
          const url = `https://portal.transitiverobotics.com/@transitive-robotics/_robot-agent/api/v1/running/${encodeURIComponent(robot.id)}`;
          const data = await fetchPortalApi<any>(token, url, { timeoutMs: 14000 });

          const hasRosTool = Boolean(
            data?.['@transitive-robotics']?.['ros-tool']
          );

          if (hasRosTool) {
            subscribeTelemetry({
              jwtSecret: config.jwtSecret,
              transitiveUser: config.transitiveUser,
              deviceId: robot.id,
            }).catch(err => log.error(`Battery subscribe failed for ${robot.id}`, err));
          }

          return {
            id: robot.id,
            name: robot.robotName,
            online: true,
            hasRosTool,
            ...(data || {})
          };
        })
      );

      return res.json(results);
    } catch (err) {
      log.error('Portal API failed on /api/devices', err);
      return res.status(502).json({ error: 'Portal API request failed' });
    }
  });

  app.get('/api/data/:deviceId', requireLogin, async (req, res) => {

    return res.json({
      deviceId: req.params.deviceId,
      telemetry: getTelemetryData(req.params.deviceId),
    });
  });

  app.get('/admin/users', requireAdmin, async (_req, res) => {
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
        dbUsers = await db.getUsersByClient(defaultClientId);
        log.info(`Fetched ${dbUsers.length} users from database for client ${defaultClientId}`);
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

  app.get('/admin/db-users', requireAdmin, async (req, res) => {
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

  app.post('/admin/users/sync', requireAdmin, async (_req, res) => {
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

  app.post('/admin/users', requireAdmin, async (req, res) => {
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

  app.get('/admin/users/:username', requireAdmin, async (req, res) => {
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

  app.post('/admin/users/:username/groups', requireAdmin, async (req, res) => {
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
      return res.json(updatedUser);
    } catch (err) {
      log.error('Set user groups failed', err);
      return res.status(502).json({ error: 'Set user groups failed' });
    }
  });

  app.post('/admin/users/:username/disable', requireAdmin, async (req, res) => {
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

  app.post('/admin/users/:username/enable', requireAdmin, async (req, res) => {
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

  app.patch('/admin/users/:username/client', requireAdmin, async (req, res) => {
    const username = req.params.username;
    const { clientName } = req.body || {};

    log.info('Patch user client request', { username, clientName });

    if (clientName !== null && clientName !== undefined && typeof clientName !== 'string') {
      return res.status(400).json({ error: 'clientName must be a string or null' });
    }

    try {
      const user = await db.getUserById(username);

      if (!user) {
        return res.status(404).json({ error: 'User not found in database' });
      }

      // 🔹 Si viene clientName → buscar client
      if (clientName) {
        const client = await db.getClientByName(clientName);

        if (!client) {
          return res.status(404).json({ error: 'Client not found' });
        }

        await db.updateUserClient(user.id, client.id);

        return res.json({
          ok: true,
          username,
          userId: user.id,
          email: user.email,
          clientId: client.id,
          clientName: client.name,
        });
      }

      // 🔹 Si viene null → quitar cliente
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
      log.error('Update user client failed', { username, clientName, error: err });
      return res.status(500).json({ error: 'Update user client failed' });
    }
  });

  app.delete('/admin/users/:username', requireAdmin, async (req, res) => {
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

  app.get('/admin/users/:clientName', requireAdmin, async (req, res) => {
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

  app.post('/admin/robots/sync', requireAdmin, async (_req, res) => {
    try {
      const token = signPortalApiJWT({
        jwtSecret: config.jwtSecret,
        transitiveUser: config.transitiveUser,
        validitySeconds: 60,
      });

      const url = `https://portal.transitiverobotics.com/@transitive-robotics/_robot-agent/api/v1/info/`;
      const data = await fetchPortalApi<any>(token, url, { timeoutMs: 14000 });

      const robots: RobotInfo[] = Object.entries(data || {})
        .filter(([, value]: [string, any]) => value!.os?.hostname)
        .map(([id, value]: [string, any]) => ({
          id,
          clientId: defaultClientId,
          hostName: value.os.hostname,
          robotName: value.os.hostname,
        }));

      console.log('Syncing robots from portal', robots);

      await db.syncRobotsSnapshot(defaultClientId, robots);

      return res.json({
        ok: true,
        count: robots.length,
        robots,
      });
    } catch (err) {
      log.error('Robot sync failed', err);
      return res.status(502).json({ error: 'Robot sync failed' });
    }
  });

  app.get('/admin/robots', requireAdmin, async (_req, res) => {
    try {
      const robots = await db.getAllRobots();
      console.log('Fetched all robots for admin', robots);
      return res.json(robots);
    } catch (err) {
      log.error('List robots failed', err);
      return res.status(500).json({ error: 'List robots failed' });
    }
  });

  app.get('/api/robots', requireLogin, async (req, res) => {
    const userEmail = req.session.user!.email!;

    let robots: RobotInfo[];
    try {
      robots = await db.getRobotIdsForUser(userEmail);
    } catch (err) {
      log.error('DB failed on /api/devices', err);
      return res.status(500).json({ error: 'Devices failed' });
    }

    return res.json(robots);
  });

  app.patch('/api/robots/:robotId/rename', requireLogin, async (req, res) => {
    const userEmail = req.session.user!.email!;
    const isAdmin = req.session.user!.admin;
    const robotId = req.params.robotId;

    const { name } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    try {
      const robots = await db.getRobotIdsForUser(userEmail);

      const hasAcces = isAdmin || robots.some((robot) => robot.id === robotId);

      if (!hasAcces) {
        return res.status(403).json({ error: 'Robot not found' })
      }

      await db.updateRobotName(robotId, name.trim());

      return res.json({
        ok: true,
        robotId,
        name: name.trim(),
      });
    } catch (err) {
      log.error('Update robot name failed', err);
      return res.status(500).json({ error: 'Update robot name failed' });
    }
  });

  app.get('/admin/robots/:robotId/users', requireAdmin, async (req, res) => {
    const robotId = req.params.robotId;

    try {
      const userIds = await db.getUsersForRobot(robotId);

      return res.json({
        robotId,
        userIds,
      });
    } catch (err) {
      log.error('Get robot users failed', err);
      return res.status(500).json({ error: 'Get robot users failed' });
    }
  });

  app.put('/admin/robots/:robotId/users', requireAdmin, async (req, res) => {
    const robotId = req.params.robotId;
    const { userIds } = req.body || {};

    if (!Array.isArray(userIds)) {
      return res.status(400).json({ error: 'userIds must be an array' });
    }

    const normalizedUserIds = [...new Set(
      userIds.filter((u: unknown): u is string => typeof u === 'string' && u.trim().length > 0)
        .map(u => u.trim().toLowerCase())
    )];

    console.log(`Setting users for robot ${robotId}:`, normalizedUserIds);

    try {
      await db.setUsersForRobot(robotId, normalizedUserIds);

      return res.json({
        ok: true,
        robotId,
        userIds: normalizedUserIds,
      });
    } catch (err: any) {
      log.error('Set robot users failed', err);
      return res.status(500).json({ error: 'Set robot users failed' });
    }
  });

  app.patch('/admin/robots/:robotId/client', requireAdmin, async (req, res) => {
    const robotId = req.params.robotId;
    const { clientName } = req.body || {};

    if (clientName !== null && clientName !== undefined && typeof clientName !== 'string') {
      return res.status(400).json({ error: 'clientName must be a string or null' });
    }

    try {
      if (!clientName) {
        await db.updateRobotClient(robotId, null);

        return res.json({
          ok: true,
          robotId,
          clientId: null,
          clientName: null,
        });
      }

      const client = await db.getClientByName(clientName);

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      await db.updateRobotClient(robotId, client.id);

      return res.json({
        ok: true,
        robotId,
        clientId: client.id,
        clientName: client.name,
      });
    } catch (err) {
      log.error('Update robot client failed', { robotId, clientName, error: err });
      return res.status(500).json({ error: 'Update robot client failed' });
    }
  });

  // Client operations
  app.get('/admin/clients', requireAdmin, async (_req, res) => {
    try {
      const clients = await db.getAllClients();
      return res.json(clients);
    } catch (err) {
      log.error('List clients failed', err);
      return res.status(500).json({ error: 'List clients failed' });
    }
  });

  app.post('/admin/clients', requireAdmin, async (req, res) => {
    const { name } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'name is required and must be a non-empty string',
      });
    }

    try {
      const clientId = await db.createClient(name.trim());
      return res.status(201).json({
        ok: true,
        id: clientId,
        name: name.trim(),
      });
    } catch (err) {
      log.error('Create client failed', err);
      return res.status(500).json({ error: 'Create client failed' });
    }
  });

  app.get('/admin/clients/:id', requireAdmin, async (req, res) => {
    const clientId = req.params.id;

    try {
      const client = await db.getClient(clientId);
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      return res.json(client);
    } catch (err) {
      log.error('Get client failed', err);
      return res.status(500).json({ error: 'Get client failed' });
    }
  });

  app.delete('/admin/clients/:id', requireAdmin, async (req, res) => {
    const clientId = req.params.id;

    try {
      const client = await db.getClient(clientId);
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      await db.deleteClient(clientId);
      return res.json({
        ok: true,
        id: clientId,
      });
    } catch (err) {
      log.error('Delete client failed', err);
      return res.status(500).json({ error: 'Delete client failed' });
    }
  });

  app.get('/', (_req, res) => {
    res.json({
      service: 'transact-backend',
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}