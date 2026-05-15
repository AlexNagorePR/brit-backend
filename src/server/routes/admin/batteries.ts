import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { requireAdmin } from '@/server/auth.js';
import {
  ClientNotFoundError,
  CreateBattery,
} from '@/application/use-cases/batteries/create-battery.js';
import { DeleteBattery } from '@/application/use-cases/batteries/delete-battery.js';
import { GetBattery } from '@/application/use-cases/batteries/get-battery.js';
import { ListBatteriesForClient } from '@/application/use-cases/batteries/list-batteries-for-client.js';
import { ListBatteryUsers } from '@/application/use-cases/batteries/list-battery-users.js';
import { SetBatteryUsers } from '@/application/use-cases/batteries/set-battery-users.js';
import { UpdateBatterySerialNumber } from '@/application/use-cases/batteries/update-battery-serial-number.js';
import {
  BatteryNotFoundError,
  BatteryValidationError,
} from '@/application/use-cases/batteries/errors.js';
import {
  createDbBatteryRepository,
} from '@/infrastructure/db/battery-repository.js';
import { createDbClientRepository } from '@/infrastructure/db/client-repository.js';

const log = utils.getLogger('routes/admin/batteries');

export function createAdminBatteriesRouter(_config: any, db: any) {
  const router = Router();
  const batteryRepository = createDbBatteryRepository(db);
  const createBattery = new CreateBattery({
    batteryRepository,
    clientRepository: createDbClientRepository(db),
  });
  const listBatteriesForClient = new ListBatteriesForClient(batteryRepository);
  const getBattery = new GetBattery(batteryRepository);
  const updateBatterySerialNumber = new UpdateBatterySerialNumber(batteryRepository);
  const deleteBattery = new DeleteBattery(batteryRepository);
  const setBatteryUsers = new SetBatteryUsers(batteryRepository);
  const listBatteryUsers = new ListBatteryUsers(batteryRepository);

  // GET /admin/batteries - List batteries for a client
  /**
   * @swagger
   * /admin/batteries:
   *   get:
   *     summary: List batteries for a client
   *     description: Returns all batteries for a specific client
   *     tags:
   *       - Admin - Batteries
   *     security:
   *       - sessionCookie: []
   *     parameters:
   *       - in: query
   *         name: clientId
   *         required: true
   *         schema:
   *           type: string
   *         description: The client ID
   *     responses:
   *       200:
   *         description: Batteries retrieved successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: User not authenticated or not admin
   *       500:
   *         description: List failed
   */
  router.get('/', requireAdmin, async (req, res) => {
    const { clientId } = req.query;

    try {
      const batteries = await listBatteriesForClient.execute({ clientId });
      return res.json(batteries);
    } catch (err) {
      if (err instanceof BatteryValidationError) {
        return res.status(400).json({ error: err.message });
      }

      log.error('List batteries failed', err);
      return res.status(500).json({ error: 'List batteries failed' });
    }
  });

  // POST /admin/batteries - Create a new battery
  /**
   * @swagger
   * /admin/batteries:
   *   post:
   *     summary: Create a new battery
   *     description: Creates a new battery for a client
   *     tags:
   *       - Admin - Batteries
   *     security:
   *       - sessionCookie: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - clientId
   *               - serialNumber
   *             properties:
   *               clientId:
   *                 type: string
   *               serialNumber:
   *                 type: string
   *               stateOfHealth:
   *                 type: number
   *     responses:
   *       201:
   *         description: Battery created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: User not authenticated or not admin
   *       404:
   *         description: Client not found
   *       500:
   *         description: Create failed
   */
  router.post('/', requireAdmin, async (req, res) => {
    const { clientId, serialNumber, stateOfHealth } = req.body || {};

    try {
      const battery = await createBattery.execute({
        clientId,
        serialNumber,
        stateOfHealth,
      });

      return res.status(201).json({
        ok: true,
        ...battery,
      });
    } catch (err) {
      if (err instanceof BatteryValidationError) {
        return res.status(400).json({ error: err.message });
      }

      if (err instanceof ClientNotFoundError) {
        return res.status(404).json({ error: err.message });
      }

      log.error('Create battery failed', err);
      return res.status(500).json({ error: 'Create battery failed' });
    }
  });

  // GET /admin/batteries/:id - Get battery details
  /**
   * @swagger
   * /admin/batteries/{id}:
   *   get:
   *     summary: Get battery by ID
   *     description: Retrieves information about a specific battery
   *     tags:
   *       - Admin - Batteries
   *     security:
   *       - sessionCookie: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Battery retrieved successfully
   *       401:
   *         description: User not authenticated or not admin
   *       404:
   *         description: Battery not found
   *       500:
   *         description: Get failed
   */
  router.get('/:id', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;

    try {
      const battery = await getBattery.execute(batteryId);
      return res.json(battery);
    } catch (err) {
      if (err instanceof BatteryNotFoundError) {
        return res.status(404).json({ error: err.message });
      }

      log.error('Get battery failed', err);
      return res.status(500).json({ error: 'Get battery failed' });
    }
  });

  // PUT /admin/batteries/:id - Update battery
  /**
   * @swagger
   * /admin/batteries/{id}:
   *   put:
   *     summary: Update battery
   *     description: Updates the serial number of a battery
   *     tags:
   *       - Admin - Batteries
   *     security:
   *       - sessionCookie: []
   *     parameters:
   *       - in: path
   *         name: id
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
   *               serialNumber:
   *                 type: string
   *     responses:
   *       200:
   *         description: Battery updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: User not authenticated or not admin
   *       500:
   *         description: Update failed
   */
  router.put('/:id', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;
    const { serialNumber } = req.body || {};

    try {
      const battery = await updateBatterySerialNumber.execute({
        id: batteryId,
        serialNumber,
      });

      return res.json({
        ok: true,
        ...battery,
      });
    } catch (err) {
      if (err instanceof BatteryValidationError) {
        return res.status(400).json({ error: err.message });
      }

      log.error('Update battery failed', err);
      return res.status(500).json({ error: 'Update battery failed' });
    }
  });

  // DELETE /admin/batteries/:id - Delete battery
  /**
   * @swagger
   * /admin/batteries/{id}:
   *   delete:
   *     summary: Delete a battery
   *     description: Deletes a battery
   *     tags:
   *       - Admin - Batteries
   *     security:
   *       - sessionCookie: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Battery deleted successfully
   *       401:
   *         description: User not authenticated or not admin
   *       500:
   *         description: Delete failed
   */
  router.delete('/:id', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;

    try {
      const battery = await deleteBattery.execute(batteryId);
      return res.json({
        ok: true,
        ...battery,
      });
    } catch (err) {
      log.error('Delete battery failed', err);
      return res.status(500).json({ error: 'Delete battery failed' });
    }
  });

  // PUT /admin/batteries/:id/users - Set users for a battery (replace all)
  /**
   * @swagger
   * /admin/batteries/{id}/users:
   *   put:
   *     summary: Set users for a battery
   *     description: Updates the users assigned to a battery (replaces all current users)
   *     tags:
   *       - Admin - Batteries
   *     security:
   *       - sessionCookie: []
   *     parameters:
   *       - in: path
   *         name: id
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
  router.put('/:id/users', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;
    const { userIds } = req.body || {};

    try {
      const result = await setBatteryUsers.execute({
        id: batteryId,
        userIds,
      });

      return res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      if (err instanceof BatteryValidationError) {
        return res.status(400).json({ error: err.message });
      }

      log.error('Set users for battery failed', err);
      return res.status(500).json({ error: 'Set users for battery failed' });
    }
  });

  // GET /admin/batteries/:id/users - Get users for a battery
  /**
   * @swagger
   * /admin/batteries/{id}/users:
   *   get:
   *     summary: Get users for a battery
   *     description: Returns all users assigned to a specific battery
   *     tags:
   *       - Admin - Batteries
   *     security:
   *       - sessionCookie: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Battery users retrieved successfully
   *       401:
   *         description: User not authenticated or not admin
   *       500:
   *         description: Get failed
   */
  router.get('/:id/users', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;

    try {
      const users = await listBatteryUsers.execute(batteryId);
      return res.json(users);
    } catch (err) {
      log.error('Get battery users failed', err);
      return res.status(500).json({ error: 'Get battery users failed' });
    }
  });

  return router;
}
