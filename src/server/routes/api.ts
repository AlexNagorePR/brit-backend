import { Router } from 'express';
import jwt from 'jsonwebtoken';
import utils from '@transitive-sdk/utils';
import { requireLogin } from '@/server/auth.js';
import { signPortalApiJWT, fetchPortalApi } from '@/server/portal.js';
import { getTelemetryData, subscribeTelemetry } from '@/server/telemetry.js';
import { RobotInfo } from '@/server/db.js';

const log = utils.getLogger('routes/api');

export function createApiRouter(config: any, db: any) {
  const router = Router();

  // Basic auth status
  router.get('/user', (req: any, res) => {
    const user = req.session?.user;
    return res.json({
      isAuthenticated: Boolean(user && user._id),
      userInfo: user || null,
    });
  });

  // Get a JWT token for the current user
  router.post('/getJWT', requireLogin, (req: any, res: any) => {
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

  router.get('/health', (_req, res) => {
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/devices', requireLogin, async (req, res) => {
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

  router.get('/data/:deviceId', requireLogin, async (req, res) => {
    return res.json({
      deviceId: req.params.deviceId,
      telemetry: getTelemetryData(req.params.deviceId),
    });
  });

  router.get('/robots', requireLogin, async (req, res) => {
    const userEmail = req.session.user!.email!;

    let robots: RobotInfo[];
    try {
      robots = await db.getRobotIdsForUser(userEmail);
    } catch (err) {
      log.error('DB failed on /api/robots', err);
      return res.status(500).json({ error: 'Devices failed' });
    }

    return res.json(robots);
  });

  router.patch('/robots/:robotId/rename', requireLogin, async (req, res) => {
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

  return router;
}
