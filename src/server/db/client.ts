import { Pool } from 'pg';
import { ClientInfo } from './types.js';

export function createClientOps(pool: Pool) {
  return {
    async createClient(name: string) {
      const { rows } = await pool.query(
        `INSERT INTO client (name)
         VALUES ($1)
         RETURNING id`,
        [name]
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
      return rows[0] || null;
    },

    async getAllClients() {
      const { rows } = await pool.query(
        `SELECT id, name
         FROM client
         ORDER BY created_at ASC`
      );
      return rows;
    },

    async deleteClient(id: string) {
      await pool.query(
        `DELETE FROM client WHERE id = $1`,
        [id]
      );
    },

    async getClientByName(name: string) {
      const { rows } = await pool.query(
        `SELECT id, name
        FROM client
        WHERE name = $1`,
        [name]
      );

      return rows[0] || null;
    },
  };
}

export type ClientOps = ReturnType<typeof createClientOps>;
