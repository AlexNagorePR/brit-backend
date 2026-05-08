import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { requireAdmin } from '@/server/auth.js';
import { signPortalApiJWT, fetchPortalApi } from '@/server/portal.js';
import { RobotInfo } from '@/server/db.js';

const log = utils.getLogger('routes/admin/robots');

export function createAdminRobotsRouter(config: any, db: any) {
  const router = Router();

  router.post('/sync', requireAdmin, async (_req, res) => {
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
          clientId: value?.clientId,
          hostName: value.os.hostname,
          robotName: value.os.hostname,
        }));

      console.log('Syncing robots from portal', robots);

      // Preserve existing client assignment in DB; do not force a default client.
      await db.syncRobotsSnapshot(null, robots);

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

  router.get('/', requireAdmin, async (_req, res) => {
    try {
      const robots = await db.getAllRobots();
      console.log('Fetched all robots for admin', robots);
      return res.json(robots);
    } catch (err) {
      log.error('List robots failed', err);
      return res.status(500).json({ error: 'List robots failed' });
    }
  });

  router.get('/:robotId', requireAdmin, async (req, res) => {
    const robotId = req.params.robotId;

    try {
      const robot = await db.getRobotById(robotId);

      if (!robot) {
        return res.status(404).json({ error: 'Robot not found' });
      }

      return res.json(robot);
    } catch (err) {
      log.error('Get robot failed', { robotId, error: err });
      return res.status(500).json({ error: 'Get robot failed' });
    }
  });

  router.get('/:robotId/users', requireAdmin, async (req, res) => {
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

  router.put('/:robotId/users', requireAdmin, async (req, res) => {
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

  router.patch('/:robotId/client', requireAdmin, async (req, res) => {
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

  return router;
}
