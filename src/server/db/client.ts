import { Pool } from 'pg';
import { ClientInfo } from './types.js';
import { Client } from '../../domain/models/client.js';

function toClientInfo(client: Client): ClientInfo {
  return {
    id: client.getId(),
    name: client.getName(),
  };
}

export function createClientOps(pool: Pool) {
  return {
    async createClient(name: string) {
      const client = Client.create(name);

      const { rows } = await pool.query(
        `INSERT INTO client (name)
         VALUES ($1)
         RETURNING id`,
        [client.getName()]
      );
      return rows[0].id;
    },

    async getClient(id: string) {
      const { rows } = await pool.query(
        `SELECT id, name
         FROM client
         WHERE id = $1`,
        [id]
      );
      if (!rows[0]) return null;

      return toClientInfo(Client.reconstruct(rows[0].id, rows[0].name));
    },

    async getAllClients() {
      const { rows } = await pool.query(
        `SELECT id, name
         FROM client
         ORDER BY created_at ASC`
      );
      return rows.map(r => toClientInfo(Client.reconstruct(r.id, r.name)));
    },

    async deleteClient(id: string) {
      await pool.query(
        `DELETE FROM client WHERE id = $1`,
        [id]
      );
    },

    async getClientByName(name: string) {
      const client = Client.create(name);

      const { rows } = await pool.query(
        `SELECT id, name
        FROM client
        WHERE name = $1`,
        [client.getName()]
      );

      if (!rows[0]) return null;

      return toClientInfo(Client.reconstruct(rows[0].id, rows[0].name));
    },
  };
}

export type ClientOps = ReturnType<typeof createClientOps>;
