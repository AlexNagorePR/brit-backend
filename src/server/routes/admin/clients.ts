import { Router } from 'express';
import utils from '@transitive-sdk/utils';
import { CreateClient } from '@/application/use-cases/clients/create-client.js';
import { DeleteClient } from '@/application/use-cases/clients/delete-client.js';
import {
  ClientNotFoundError,
  ClientValidationError,
} from '@/application/use-cases/clients/errors.js';
import { GetClient } from '@/application/use-cases/clients/get-client.js';
import { ListClients } from '@/application/use-cases/clients/list-clients.js';
import { createDbClientRepository } from '@/infrastructure/db/client-repository.js';
import { requireAdmin } from '@/server/auth.js';

const log = utils.getLogger('routes/admin/clients');

export function createAdminClientsRouter(_config: any, db: any) {
  const router = Router();
  const clientRepository = createDbClientRepository(db);
  const listClients = new ListClients(clientRepository);
  const createClient = new CreateClient(clientRepository);
  const getClient = new GetClient(clientRepository);
  const deleteClient = new DeleteClient(clientRepository);

  router.get('/', requireAdmin, async (_req, res) => {
    /**
     * @swagger
     * /admin/clients:
     *   get:
     *     summary: List all clients
     *     description: Returns a list of all clients
     *     tags:
     *       - Admin - Clients
     *     security:
     *       - sessionCookie: []
     *     responses:
     *       200:
     *         description: Clients retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 type: object
     *                 properties:
     *                   id:
     *                     type: string
     *                   name:
     *                     type: string
     *                   created:
     *                     type: string
     *                     format: date-time
     *       401:
     *         description: User not authenticated or not admin
     *       500:
     *         description: List failed
     */
    try {
      const clients = await listClients.execute();
      return res.json(clients);
    } catch (err) {
      log.error('List clients failed', err);
      return res.status(500).json({ error: 'List clients failed' });
    }
  });

  router.post('/', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/clients:
     *   post:
     *     summary: Create a new client
     *     description: Creates a new client
     *     tags:
     *       - Admin - Clients
     *     security:
     *       - sessionCookie: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *             properties:
     *               name:
     *                 type: string
     *     responses:
     *       201:
     *         description: Client created successfully
     *       400:
     *         description: Validation error
     *       401:
     *         description: User not authenticated or not admin
     *       500:
     *         description: Create failed
     */
    const { name } = req.body || {};

    try {
      const client = await createClient.execute({ name });
      return res.status(201).json({
        ok: true,
        ...client,
      });
    } catch (err) {
      if (err instanceof ClientValidationError) {
        return res.status(400).json({ error: err.message });
      }

      log.error('Create client failed', err);
      return res.status(500).json({ error: 'Create client failed' });
    }
  });

  router.get('/:id', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/clients/{id}:
     *   get:
     *     summary: Get client by ID
     *     description: Retrieves information about a specific client
     *     tags:
     *       - Admin - Clients
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
     *         description: Client retrieved successfully
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: Client not found
     *       500:
     *         description: Get failed
     */
    const clientId = req.params.id;

    try {
      const client = await getClient.execute(clientId);
      return res.json(client);
    } catch (err) {
      if (err instanceof ClientNotFoundError) {
        return res.status(404).json({ error: err.message });
      }

      log.error('Get client failed', err);
      return res.status(500).json({ error: 'Get client failed' });
    }
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    /**
     * @swagger
     * /admin/clients/{id}:
     *   delete:
     *     summary: Delete a client
     *     description: Deletes a client
     *     tags:
     *       - Admin - Clients
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
     *         description: Client deleted successfully
     *       401:
     *         description: User not authenticated or not admin
     *       404:
     *         description: Client not found
     *       500:
     *         description: Delete failed
     */
    const clientId = req.params.id;

    try {
      const result = await deleteClient.execute(clientId);
      return res.json({
        ok: true,
        ...result,
      });
    } catch (err) {
      if (err instanceof ClientNotFoundError) {
        return res.status(404).json({ error: err.message });
      }

      log.error('Delete client failed', err);
      return res.status(500).json({ error: 'Delete client failed' });
    }
  });

  return router;
}
