import { Router } from 'express';
import jwt from 'jsonwebtoken';
import utils from '@transitive-sdk/utils';
import { ListRunningDevices } from '@/application/use-cases/devices/list-running-devices.js';
import { RobotValidationError } from '@/application/use-cases/robots/errors.js';
import { ListRobotsForUser } from '@/application/use-cases/robots/list-robots-for-user.js';
import { UpdateRobotName } from '@/application/use-cases/robots/update-robot-name.js';
import { createDbRobotRepository } from '@/infrastructure/db/robot-repository.js';
import { createPortalApi } from '@/infrastructure/portal/portal-api.js';
import { requireLogin } from '@/server/auth.js';
import { getTelemetryData, subscribeTelemetry } from '@/server/device-data-stream.js';
import { initializeCommandPublisher, publishCommand } from '@/server/device-command-publisher.js';
import type { Db } from '@/server/db.js';
import type { RobotReadModel } from '@/application/ports/robot-repository.js';

const log = utils.getLogger('routes/api');

export function createApiRouter(config: any, db: Db) {
  const router = Router();
  const robotRepository = createDbRobotRepository(db);
  const listRunningDevices = new ListRunningDevices(createPortalApi(config));
  const listRobotsForUser = new ListRobotsForUser(robotRepository);
  const updateRobotName = new UpdateRobotName(robotRepository);

  // Basic auth status
  /**
   * @swagger
   * /api/user:
   *   get:
   *     summary: Get current user information
   *     description: Returns the authenticated user information or null if not logged in
   *     tags:
   *       - User
   *     responses:
   *       200:
   *         description: User information retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 isAuthenticated:
   *                   type: boolean
   *                   example: true
   *                 userInfo:
   *                   type: object
   *                   nullable: true
   *                   properties:
   *                     _id:
   *                       type: string
   *                       example: "user@example.com"
   *                     email:
   *                       type: string
   *                       example: "user@example.com"
   *                     admin:
   *                       type: boolean
   *                       example: false
   *                     verified:
   *                       type: boolean
   *                       example: true
   *                     created:
   *                       type: string
   *                       format: date-time
   */
  router.get('/user', (req: any, res) => {
    const user = req.session?.user;
    return res.json({
      isAuthenticated: Boolean(user && user._id),
      userInfo: user || null,
    });
  });

  // Get a JWT token for the current user
  /**
   * @swagger
   * /api/getJWT:
   *   post:
   *     summary: Generate JWT token for current user
   *     description: Creates a signed JWT token for the authenticated user to use with other services
   *     tags:
   *       - User
   *     security:
   *       - sessionCookie: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               capability:
   *                 type: string
   *                 example: "ignore"
   *                 description: "Capability level (cannot end with _robot-agent)"
   *     responses:
   *       200:
   *         description: JWT token generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *       400:
   *         description: Invalid capability (ends with _robot-agent) or validation error
   *       401:
   *         description: User not authenticated
   */
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
    /**
     * @swagger
     * /api/health:
     *   get:
     *     summary: API health check
     *     description: Returns the health status of the API
     *     tags:
     *       - Health
     *     responses:
     *       200:
     *         description: API is healthy
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: "ok"
     *                 timestamp:
     *                   type: string
     *                   format: date-time
     *                   example: "2026-05-15T14:35:20.123Z"
     */
    return res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/devices', requireLogin, async (req, res) => {
    /**
     * @swagger
     * /api/devices:
     *   get:
     *     summary: List all devices for current user
     *     description: Returns all devices available to the authenticated user from Portal API
     *     tags:
     *       - Devices
     *     security:
     *       - sessionCookie: []
     *     responses:
     *       200:
     *         description: List of devices retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   id:
     *                     type: string
     *                     example: "device-001"
     *                   name:
     *                     type: string
     *                     example: "Robot Arm A"
     *                   status:
     *                     type: string
     *                     enum: [online, offline]
     *                     example: "online"
     *                   hasRosTool:
     *                     type: boolean
     *                     example: true
     *                   connected:
     *                     type: boolean
     *                     example: true
     *       401:
     *         description: User not authenticated
     *       500:
     *         description: Database error
     *       502:
     *         description: Portal API request failed
     */
    const userEmail = req.session.user!.email!;

    console.log('Fetching devices for user', userEmail);

    let robots: RobotReadModel[];
    try {
      robots = await listRobotsForUser.execute(userEmail);
    } catch (err) {
      log.error('DB failed on /api/devices', err);
      return res.status(500).json({ error: 'Devices failed' });
    }

    try {
      const results = await listRunningDevices.execute(robots);

      for (const device of results) {
        if (device.hasRosTool) {
          subscribeTelemetry({
            jwtSecret: config.jwtSecret,
            transitiveUser: config.transitiveUser,
            deviceId: device.id,
          }).catch(err => log.error(`Battery subscribe failed for ${device.id}`, err));
        }
      }

      return res.json(results);
    } catch (err) {
      log.error('Portal API failed on /api/devices', err);
      return res.status(502).json({ error: 'Portal API request failed' });
    }
  });

  router.get('/data/:deviceId', requireLogin, async (req, res) => {
    /**
     * @swagger
     * /api/data/{deviceId}:
     *   get:
     *     summary: Get telemetry data for a device
     *     description: Returns telemetry data for a specific device
     *     tags:
     *       - Devices
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: deviceId
     *         required: true
     *         schema:
     *           type: string
     *         example: "device-001"
     *         description: The device ID
     *     responses:
     *       200:
     *         description: Telemetry data retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 deviceId:
     *                   type: string
     *                   example: "device-001"
     *                 telemetry:
     *                   type: object
     *                   example: 
     *                     battery: 85
     *                     temperature: 42.5
     *                     lastUpdate: "2026-05-15T14:30:00Z"
     *       401:
     *         description: User not authenticated
     */
    return res.json({
      deviceId: req.params.deviceId,
      telemetry: getTelemetryData(req.params.deviceId),
    });
  });

  router.get('/robots', requireLogin, async (req, res) => {
    /**
     * @swagger
     * /api/robots:
     *   get:
     *     summary: List all robots for current user
     *     description: Returns all robots assigned to the authenticated user from the database
     *     tags:
     *       - Robots
     *     security:
     *       - sessionCookie: []
     *     responses:
     *       200:
     *         description: List of robots retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   id:
     *                     type: string
     *                     example: "robot-001"
     *                   name:
     *                     type: string
     *                     example: "Robot Alpha"
     *                   clientId:
     *                     type: string
     *                     nullable: true
     *                     example: "client-123"
     *                   created:
     *                     type: string
     *                     format: date-time
     *       401:
     *         description: User not authenticated
     *       500:
     *         description: Database error
     */
    const userEmail = req.session.user!.email!;

    let robots: RobotReadModel[];
    try {
      robots = await listRobotsForUser.execute(userEmail);
    } catch (err) {
      log.error('DB failed on /api/robots', err);
      return res.status(500).json({ error: 'Devices failed' });
    }

    return res.json(robots);
  });

  router.patch('/robots/:robotId/rename', requireLogin, async (req, res) => {
    /**
     * @swagger
     * /api/robots/{robotId}/rename:
     *   patch:
     *     summary: Rename a robot
     *     description: Updates the name of a robot. Only admins or users with access to the robot can rename it
     *     tags:
     *       - Robots
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: robotId
     *         required: true
     *         schema:
     *           type: string
     *         example: "robot-001"
     *         description: The robot ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *                 example: "Mi Robot Personalizado"
     *     responses:
     *       200:
     *         description: Robot renamed successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 ok:
     *                   type: boolean
     *                   example: true
     *                 robotId:
     *                   type: string
     *                   example: "robot-001"
     *                 name:
     *                   type: string
     *                   example: "Mi Robot Personalizado"
     *       400:
     *         description: Empty name or validation error
     *       403:
     *         description: Access denied (robot not found for user)
     *       401:
     *         description: User not authenticated
     */
    const userEmail = req.session.user!.email!;
    const isAdmin = req.session.user!.admin;
    const robotId = req.params.robotId;

    const { name } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    try {
      const robots = await listRobotsForUser.execute(userEmail);

      const hasAccess = isAdmin || robots.some((robot) => robot.id === robotId);

      if (!hasAccess) {
        return res.status(403).json({ error: 'Robot not found' });
      }

      const result = await updateRobotName.execute({
        id: robotId,
        name,
      });

      return res.json({
        ok: true,
        robotId: result.robotId,
        name: result.name,
      });
    } catch (err) {
      if (err instanceof RobotValidationError) {
        return res.status(400).json({ error: err.message });
      }

      log.error('Update robot name failed', err);
      return res.status(500).json({ error: 'Update robot name failed' });
    }
  });

  router.post('/commands/:deviceId', requireLogin, async (req: any, res) => {
    /**
     * @swagger
     * /api/commands/{deviceId}:
     *   post:
     *     summary: Publish a command to a device
     *     description: Publishes a command to a specific device. Only admins or users with access to the device can publish commands
     *     tags:
     *       - Commands
     *     security:
     *       - sessionCookie: []
     *     parameters:
     *       - in: path
     *         name: deviceId
     *         required: true
     *         schema:
     *           type: string
     *         example: "device-001"
     *         description: The device ID
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               topic:
     *                 type: string
     *                 example: "/robot/command/movement"
     *                 description: The MQTT topic for the command
     *               message:
     *                 type: object
     *                 example:
     *                   action: "move_forward"
     *                   distance: 10
     *                 description: The message payload as an object
     *     responses:
     *       200:
     *         description: Command published successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 ok:
     *                   type: boolean
     *                   example: true
     *                 deviceId:
     *                   type: string
     *                   example: "device-001"
     *                 topic:
     *                   type: string
     *                   example: "/robot/command/movement"
     *                 message:
     *                   type: object
     *       400:
     *         description: Invalid topic or message, or command publish failed
     *       403:
     *         description: Access denied (device not found for user)
     *       401:
     *         description: User not authenticated
     */
    const userEmail = req.session.user!.email!;
    const isAdmin = req.session.user!.admin;
    const deviceId = req.params.deviceId;
    const { topic, message } = req.body || {};

    // Validate input
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required and must be a string' });
    }

    if (!message || typeof message !== 'object') {
      return res.status(400).json({ error: 'message is required and must be an object' });
    }

    try {
      // Check if user has access to this device
      const robots = await listRobotsForUser.execute(userEmail);
      const hasAccess = isAdmin || robots.some((robot) => robot.id === deviceId);

      if (!hasAccess) {
        return res.status(403).json({ error: 'Device not found' });
      }

      // Initialize command publisher for this device
      await initializeCommandPublisher({
        jwtSecret: config.jwtSecret,
        transitiveUser: config.transitiveUser,
        deviceId,
      });

      // Publish the command
      await publishCommand(deviceId, topic, message);

      return res.json({
        ok: true,
        deviceId,
        topic,
        message,
      });
    } catch (err) {
      log.error(`Failed to publish command for device ${deviceId}:`, err);
      const errorMessage = (err as any).message || 'Failed to publish command';
      return res.status(400).json({ error: errorMessage });
    }
  });

  return router;
}
