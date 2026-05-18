import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { ClientNotFoundError } from '@/application/use-cases/clients/errors.js';
import { RobotNotFoundError, RobotValidationError } from '@/application/use-cases/robots/errors.js';
import type { GetRobot } from '@/application/use-cases/robots/get-robot.js';
import type { ListRobots } from '@/application/use-cases/robots/list-robots.js';
import type { ListRobotUsers } from '@/application/use-cases/robots/list-robot-users.js';
import type { SetRobotUsers } from '@/application/use-cases/robots/set-robot-users.js';
import type { SyncRobotsFromPortal } from '@/application/use-cases/robots/sync-robots-from-portal.js';
import type { UpdateRobotClientByName } from '@/application/use-cases/robots/update-robot-client-by-name.js';
import { requireAdmin } from '@/server/auth.js';

const log = utils.getLogger('routes/admin/robots');

export type AdminRobotsRouterDeps = {
  getRobot: GetRobot;
  listRobots: ListRobots;
  listRobotUsers: ListRobotUsers;
  setRobotUsers: SetRobotUsers;
  syncRobotsFromPortal: SyncRobotsFromPortal;
  updateRobotClientByName: UpdateRobotClientByName;
};

export function createAdminRobotsRouter(deps: AdminRobotsRouterDeps) {
  const router = Router();

  router.post('/sync', requireAdmin, async (_req, res) => {
    /**
     * @swagger
     * /admin/robots/sync:
     *   post:
     *     summary: Sync robots from Portal API
     *     description: Synchronizes all robots from Portal API with the database
     *     tags:
     *       - Admin - Robots
     *     security:
     *       - sessionCookie: []
     *     responses:
     *       200:
     *         description: Robots synced successfully
     *       401:
     *         description: User not authenticated or not admin
     *       502:
     *         description: Portal API request failed
     */
    try {
      const result = await deps.syncRobotsFromPortal.execute();

      return res.json({
        ok: true,
        count: result.count,
        robots: result.robots,
      });
    } catch (err) {
      log.error('Robot sync failed', err);
      return res.status(502).json({ error: 'Robot sync failed' });
    }
  });

  router.get('/', requireAdmin, async (_req, res) => {
    /**
     * @swagger
     * /admin/robots:
     *   get:
     *     summary: List all robots
     *     description: Returns a list of all robots
     *     tags:
     *       - Admin - Robots
     *     security:
     *       - sessionCookie: []
     *     responses:
     *       200:
     *         description: Robots retrieved successfully
     *       401:
     *         description: User not authenticated or not admin
     *       500:
     *         description: List failed
     */
    try {
      const robots = await deps.listRobots.execute();
      return res.json(robots);
    } catch (err) {
      log.error('List robots failed', err);
      return res.status(500).json({ error: 'List robots failed' });
    }
  });

  router.get('/:robotId', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/robots/{robotId}:
     *   get:
     *     summary: Get robot by ID
     *     description: Retrieves information about a specific robot
     *     tags:
     *       - Admin - Robots
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: robotId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Robot retrieved successfully
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: Robot not found
     *       500:
     *         description: Get failed
     */
    const robotId = req.params.robotId;

    try {
      const robot = await deps.getRobot.execute(robotId);
      return res.json(robot);
    } catch (err) {
      if (err instanceof RobotNotFoundError) {
        return res.status(404).json({ error: err.message });
      }

      log.error('Get robot failed', { robotId, error: err });
      return res.status(500).json({ error: 'Get robot failed' });
    }
  });

  router.get('/:robotId/users', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/robots/{robotId}/users:
     *   get:
     *     summary: Get users for a robot
     *     description: Returns all user IDs assigned to a specific robot
     *     tags:
     *       - Admin - Robots
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: robotId
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Robot users retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 robotId:
     *                   type: string
     *                 userIds:
     *                   type: array
     *                   items:
     *                     type: string
     *                   description: User IDs assigned to the robot
     *       401:
     *         description: User not authenticated or not admin
     *       500:
     *         description: Get failed
     */
    const robotId = req.params.robotId;

    try {
      const userIds = await deps.listRobotUsers.execute(robotId);

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
    /**
     * @swagger
     * /admin/robots/{robotId}/users:
     *   put:
     *     summary: Set users for a robot
     *     description: Updates the user IDs assigned to a robot (replaces all current users)
     *     tags:
     *       - Admin - Robots
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: robotId
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
     *               userIds:
     *                 type: array
     *                 description: User IDs to assign to the robot
     *                 items:
     *                   type: string
     *     responses:
     *       200:
     *         description: Users updated successfully
     *       400:
     *         description: Validation error
     *       401:
     *         description: User not authenticated or not admin
     *       500:
     *         description: Update failed
     */
    const robotId = req.params.robotId;
    const { userIds } = req.body || {};

    try {
      const result = await deps.setRobotUsers.execute({ robotId, userIds });

      return res.json({
        ok: true,
        ...result,
      });
    } catch (err: any) {
      if (err instanceof RobotValidationError) {
        return res.status(400).json({ error: err.message });
      }

      log.error('Set robot users failed', err);
      return res.status(500).json({ error: 'Set robot users failed' });
    }
  });

  router.patch('/:robotId/client', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/robots/{robotId}/client:
     *   patch:
     *     summary: Assign or remove client for robot
     *     description: Associates a robot with a client by client name or removes the association
     *     tags:
     *       - Admin - Robots
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: robotId
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
     *               clientName:
     *                 type: string
     *                 nullable: true
     *                 description: The client name or null to remove assignment
     *     responses:
     *       200:
     *         description: Robot client assignment updated successfully
     *       400:
     *         description: clientName must be string or null
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: Client not found
     *       500:
     *         description: Update failed
     */
    const robotId = req.params.robotId;
    const { clientName } = req.body || {};

    try {
      const result = await deps.updateRobotClientByName.execute({ robotId, clientName });
      return res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      if (err instanceof RobotValidationError) {
        return res.status(400).json({ error: err.message });
      }

      if (err instanceof ClientNotFoundError) {
        return res.status(404).json({ error: err.message });
      }

      log.error('Update robot client failed', { robotId, clientName, error: err });
      return res.status(500).json({ error: 'Update robot client failed' });
    }
  });

  return router;
}
