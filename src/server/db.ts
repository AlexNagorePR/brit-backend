// src/server/db.ts
import { Pool } from 'pg';

export type RobotInfo = {
  id: string;
  hostname: string;
  name?: string;
};

export type Db = {
  getRobotIdsForUser(user: string): Promise<RobotInfo[]>;
  getUsersIdsForRobot(user: string): Promise<string[]>;
  setUsersForRobot(robotId: string, userIds: string[]): Promise<void>;
  addUserToRobot(robotId: string, userId: string): Promise<void>;
  removeUserFromRobot(robotId: string, userId: string): Promise<void>;

  createUser(email:string): Promise<void>;
  deleteUser(email:string): Promise<void>;

  getAllRobots(): Promise<RobotInfo[]>;
  upsertRobot(id: string, name:string): Promise<void>;
  updateRobotName(id: string, name: string): Promise<void>;
  deleteRobot(id: string): Promise<void>;
  syncRobotsSnapshot(robots: RobotInfo[]): Promise<void>;
};

export function createDb(databaseUrl: string): Db {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async getRobotIdsForUser(user) {
      const { rows } = await pool.query(
        `SELECT r.robot_id, r.robot_name, r.hostname
         FROM user_robots ur
         JOIN robots r ON r.robot_id = ur.robot_id
         WHERE user_id = $1`,
        [user]
      );

      return rows.map(r => ({
        id: r.robot_id,
        hostname: r.hostname,
        name: r.robot_name,
      }));
    },

    async createUser(email) {
      await pool.query(
        `INSERT INTO users (email)
         VALUES ($1)
         ON CONFLICT (email) DO NOTHING`,
         [email]
      );
    },

    async deleteUser(email) {
      await pool.query(
        `DELETE FROM users
        WHERE email = $1`,
        [email]
      );
    },

    async getAllRobots() {
      const { rows } = await pool.query(
        `SELECT robot_id, hostname, robot_name
         FROM robots
         ORDER BY created_at ASC`
      );

      return rows.map(r => ({
        id: r.robot_id,
        hostname: r.hostname,
        name: r.robot_name,
      }));
    },

    async upsertRobot(id, hostname) {
      await pool.query(
        `INSERT INTO robots (robot_id, hostname, robot_name)
         VALUES ($1, $2, $2)
         ON CONFLICT (robot_id)
         DO UPDATE SET hostname = EXCLUDED.hostname`,
        [id, hostname]
      );
    },

    async updateRobotName(id, name) {
      await pool.query(
        `UPDATE robots
         SET robot_name = $2
         WHERE robot_id = $1`,
        [id, name]
      );
    },

    async deleteRobot(id) {
      await pool.query(
        `DELETE FROM robots
         WHERE robot_id = $1`,
        [id]
      );
    },

    async syncRobotsSnapshot(robots) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        for (const robot of robots) {
          await client.query(
            `INSERT INTO robots (robot_id, hostname, robot_name)
             VALUES ($1, $2, $2)
             ON CONFLICT (robot_id)
             DO UPDATE SET hostname = EXCLUDED.hostname`,
            [robot.id, robot.hostname]
          );
        }

        const ids = robots.map(r => r.id);

        if (ids.length === 0) {
          await client.query(`DELETE FROM robots`);
        } else {
          await client.query(
            `DELETE FROM robots
             WHERE robot_id NOT IN (
               SELECT UNNEST($1::text[])
             )`,
            [ids]
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

    async addUserToRobot(robotId, userId) {
      await pool.query(
        `INSERT INTO user_robots (user_id, robot_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, robot_id) DO NOTHING`,
        [userId, robotId]
      );
    },

    async removeUserFromRobot(robotId, userId) {
      await pool.query(
        `DELETE FROM user_robots
        WHERE user_id = $1 AND robot_id = $2`,
        [userId, robotId]
      );
    },

    async getUsersIdsForRobot(robotId) {
      const { rows } = await pool.query(
        `SELECT user_id
        FROM user_robots
        WHERE robot_id = $1
        ORDER BY user_id ASC`,
        [robotId]
      );

      return rows.map(r => r.user_id);
    },

    async setUsersForRobot(robotId, userIds) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await client.query(
          `DELETE FROM user_robots
          WHERE robot_id = $1`,
          [robotId]
        );

        for (const userId of userIds) {
          await client.query(
            `INSERT INTO user_robots (user_id, robot_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, robot_id) DO NOTHING`,
            [userId, robotId]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}