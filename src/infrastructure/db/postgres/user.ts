import { Pool } from 'pg';
import { UserInfo } from './types.js';
import { User } from '@/domain/models/user.js';

function toUserInfo(user: User): UserInfo {
  return {
    id: user.getId(),
    email: user.getEmail(),
    clientId: user.getClientId() ?? null,
  };
}

export function createUserOps(pool: Pool) {
  return {
    async getUserByEmail(email: string) {
      const { rows } = await pool.query(
        `SELECT id, email, client_id
         FROM "user"
         WHERE email = $1`,
        [email]
      );
      if (!rows[0]) return null;

      return toUserInfo(User.reconstruct(rows[0].id, rows[0].email, rows[0].client_id ?? undefined));
    },

    async getUserById(id: string) {
      const { rows } = await pool.query(
        `SELECT id, email, client_id
         FROM "user"
         WHERE id = $1`,
        [id]
      );
      if (!rows[0]) return null;

      return toUserInfo(User.reconstruct(rows[0].id, rows[0].email, rows[0].client_id ?? undefined));
    },

    async getUsersByClient(clientId: string) {
      const { rows } = await pool.query(
        `SELECT id, email, client_id
         FROM "user"
         WHERE client_id = $1
         ORDER BY email ASC`,
        [clientId]
      );
      return rows.map(r => toUserInfo(User.reconstruct(r.id, r.email, r.client_id ?? undefined)));
    },

    async getAllUsers() {
      const { rows } = await pool.query(
        `SELECT id, email, client_id
         FROM "user"
         ORDER BY email ASC`
      );
      return rows.map(r => toUserInfo(User.reconstruct(r.id, r.email, r.client_id ?? undefined)));
    },

    async createUser(userId: string, email: string, clientId?: string) {
      const user = User.create(userId, email, clientId);

      const { rows } = await pool.query(
        `INSERT INTO "user" (id, email, client_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (id)
        DO UPDATE SET
          email = EXCLUDED.email,
          client_id = COALESCE(EXCLUDED.client_id, "user".client_id)
        RETURNING id`,
        [user.getId(), user.getEmail(), user.getClientId() ?? null]
      );

      return rows[0]?.id || '';
    },

    async deleteUser(id: string) {
      await pool.query(
        `DELETE FROM "user"
        WHERE id = $1`,
        [id]
      );
    },

    async updateUserClient(userId: string, clientId: string | null) {
      await pool.query(
        `UPDATE "user"
        SET client_id = $2
        WHERE id = $1`,
        [userId, clientId]
      );
    },

    async syncUsersSnapshot(clientId: string, emails: string[]) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        console.log(`[syncUsersSnapshot] Starting sync for clientId: ${clientId} with ${emails.length} emails`);

        for (const email of emails) {
          const result = await client.query(
            `INSERT INTO "user" (client_id, email)
             VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET client_id = EXCLUDED.client_id
             RETURNING id, email, client_id`,
            [clientId, email]
          );
          console.log(`[syncUsersSnapshot] User upserted: ${email}`, result.rows[0]);
        }

        const currentUsers = await client.query(
          `SELECT id, email, client_id FROM "user" WHERE client_id = $1`,
          [clientId]
        );
        console.log(`[syncUsersSnapshot] Current users in DB for client ${clientId}:`, currentUsers.rows);

        if (emails.length === 0) {
          console.log(`[syncUsersSnapshot] No emails provided, deleting all users for client ${clientId}`);
          await client.query(`DELETE FROM "user" WHERE client_id = $1`, [clientId]);
        } else {
          const deleteResult = await client.query(
            `DELETE FROM "user"
             WHERE client_id = $1 AND email NOT IN (
               SELECT UNNEST($2::text[])
             )
             RETURNING id, email`,
            [clientId, emails]
          );
          console.log(`[syncUsersSnapshot] Deleted ${deleteResult.rowCount} users not in identity provider:`, deleteResult.rows);
        }

        const finalUsers = await client.query(
          `SELECT id, email, client_id FROM "user" WHERE client_id = $1`,
          [clientId]
        );
        console.log(`[syncUsersSnapshot] Final users in DB for client ${clientId}:`, finalUsers.rows);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[syncUsersSnapshot] Error during sync:`, error);
        throw error;
      } finally {
        client.release();
      }
    },

    async syncIdentityUsers(users: { username: string; email: string }[]) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        for (const { username, email } of users) {
          const user = User.create(username, email);

          await client.query(
            `INSERT INTO "user" (id, email)
            VALUES ($1, $2)
            ON CONFLICT (id)
            DO UPDATE SET
              email = EXCLUDED.email
            RETURNING id`,
            [user.getId(), user.getEmail()]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

export type UserOps = ReturnType<typeof createUserOps>;
