import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { requireAdmin } from '@/server/auth.js';

const log = utils.getLogger('routes/admin/clients');

export function createAdminClientsRouter(_config: any, db: any) {
  const router = Router();

  router.get('/', requireAdmin, async (_req, res) => {
    try {
      const clients = await db.getAllClients();
      return res.json(clients);
    } catch (err) {
      log.error('List clients failed', err);
      return res.status(500).json({ error: 'List clients failed' });
    }
  });

  router.post('/', requireAdmin, async (req, res) => {
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

  router.get('/:id', requireAdmin, async (req, res) => {
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

  router.delete('/:id', requireAdmin, async (req, res) => {
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

  return router;
}
