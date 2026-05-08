import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { requireAdmin } from '@/server/auth.js';

const log = utils.getLogger('routes/admin/batteries');

export function createAdminBatteriesRouter(_config: any, db: any) {
  const router = Router();

  // GET /admin/batteries - List batteries for a client
  router.get('/', requireAdmin, async (req, res) => {
    const { clientId } = req.query;

    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({
        error: 'clientId query parameter is required',
      });
    }

    try {
      const batteries = await db.getBatteriesForClient(clientId as string);
      return res.json(batteries);
    } catch (err) {
      log.error('List batteries failed', err);
      return res.status(500).json({ error: 'List batteries failed' });
    }
  });

  // POST /admin/batteries - Create a new battery
  router.post('/', requireAdmin, async (req, res) => {
    const { clientId, serialNumber, stateOfHealth } = req.body || {};

    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({
        error: 'clientId is required and must be a string',
      });
    }

    // Validate that client exists
    try {
      const client = await db.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
    } catch (err) {
      log.error('Client lookup failed', err);
      return res.status(500).json({ error: 'Client lookup failed' });
    }

    try {
      const batteryId = await db.createBattery(
        clientId,
        serialNumber || undefined,
        typeof stateOfHealth === 'number' ? stateOfHealth : undefined
      );

      return res.status(201).json({
        ok: true,
        id: batteryId,
        clientId,
        serialNumber: serialNumber || null,
        stateOfHealth: stateOfHealth || null,
      });
    } catch (err) {
      log.error('Create battery failed', err);
      return res.status(500).json({ error: 'Create battery failed' });
    }
  });

  // GET /admin/batteries/:id - Get battery details
  router.get('/:id', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;

    try {
      const battery = await db.getBattery(batteryId);
      
      if (!battery) {
        return res.status(404).json({ error: 'Battery not found' });
      }

      return res.json(battery);
    } catch (err) {
      log.error('Get battery failed', err);
      return res.status(500).json({ error: 'Get battery failed' });
    }
  });

  // PUT /admin/batteries/:id - Update battery
  router.put('/:id', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;
    const { serialNumber } = req.body || {};

    // Build updates object with only provided fields
    const updates: any = {};
    if (serialNumber !== undefined) updates.serialNumber = serialNumber;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'At least one field (serialNumber) must be provided',
      });
    }

    try {
      await db.updateBattery(batteryId, updates);
      return res.json({
        ok: true,
        id: batteryId,
        ...updates,
      });
    } catch (err) {
      log.error('Update battery failed', err);
      return res.status(500).json({ error: 'Update battery failed' });
    }
  });

  // DELETE /admin/batteries/:id - Delete battery
  router.delete('/:id', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;

    try {
      await db.deleteBattery(batteryId);
      return res.json({
        ok: true,
        id: batteryId,
      });
    } catch (err) {
      log.error('Delete battery failed', err);
      return res.status(500).json({ error: 'Delete battery failed' });
    }
  });

  // PUT /admin/batteries/:id/users - Set users for a battery (replace all)
  router.put('/:id/users', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;
    const { userIds } = req.body || {};

    if (!Array.isArray(userIds)) {
      return res.status(400).json({
        error: 'userIds must be an array',
      });
    }

    try {
      await db.setUsersForBattery(batteryId, userIds);
      return res.json({
        ok: true,
        batteryId,
        userIds,
      });
    } catch (err) {
      log.error('Set users for battery failed', err);
      return res.status(500).json({ error: 'Set users for battery failed' });
    }
  });

  // GET /admin/batteries/:id/users - Get users for a battery
  router.get('/:id/users', requireAdmin, async (req, res) => {
    const batteryId = req.params.id;

    try {
      const users = await db.getUsersForBattery(batteryId);
      return res.json(users);
    } catch (err) {
      log.error('Get battery users failed', err);
      return res.status(500).json({ error: 'Get battery users failed' });
    }
  });

  return router;
}
