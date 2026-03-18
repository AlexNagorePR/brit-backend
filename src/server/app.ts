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
import { getTelemetryData, subscribeTelemetry } from '@/server/ros.js';
import { createCognitoAdminService } from './cognito-admin.js';

const log = utils.getLogger('app');
const FileStore = FileStoreFactory(session);

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
      cookie:{
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

      const email = claims.email as string | undefined;
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

  app.get('/api/devices', requireLogin, async (req, res) => {
    const user = req.session.user!._id;

    let robots: RobotInfo[];
    try {
      robots = await db.getRobotIdsForUser(user);
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
            name: robot.name,
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
      const users = await cognitoAdmin.listUsers();
      return res.json(users);
    } catch (err) {
      log.error('Cognito list users failed', err);
      return res.status(502).json({ error: 'List users failed' });
    }
  });

  app.post('/admin/users', requireAdmin, async (req, res) => {
    const { email, groups, temporaryPassword, givenName, familyName } = req.body || {};

    if (!email) {
      return res.status(400).json({
        error: 'email is required',
      });
    }

    if (groups && !Array.isArray(groups)) {
      return res.status(400).json({
        error: 'groups must be an array of strings',
      });
    }

    try {
      const user = await cognitoAdmin.createUser({
        email,
        temporaryPassword,
        givenName,
        familyName,
        groups,
      });

      await db.createUser(email);

      return res.status(201).json(user);
    } catch (err) {
      log.error('Cognito create user failed', err);
      return res.status(502).json({ error: 'Create user failed' });
    }
  });

  app.get('/admin/users/:username', requireAdmin, async(req, res) => {
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
          hostname: value.os.hostname,
        })
      );

      await db.syncRobotsSnapshot(robots);

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
      return res.json(robots);
    } catch (err) {
      log.error('List robots failed', err);
      return res.status(500).json({ error: 'List robots failed' });
    }
  });

  app.get('/api/robots', requireLogin, async (req, res) => {
    const user = req.session.user!._id;

    let robots: RobotInfo[];
    try {
      robots = await db.getRobotIdsForUser(user);
    } catch (err) {
      log.error('DB failed on /api/devices', err);
      return res.status(500).json({ error: 'Devices failed' });
    }

    return res.json(robots);
  });

  app.patch('/api/robots/:robotId/rename', requireLogin, async (req, res) => {
    const userId = req.session.user!._id;
    const isAdmin = req.session.user!.admin;
    const robotId = req.params.robotId;

    const { name } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    try {
      const robots = await db.getRobotIdsForUser(userId);

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
      const userIds = await db.getUsersIdsForRobot(robotId);

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

  app.get('/', (_req, res) => {
    res.json({
      service: 'transact-backend',
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}