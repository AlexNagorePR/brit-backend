import { Pool } from 'pg';

export type Db = {
  getRobotIdsForUser(userId: string): Promise<string[]>;
};

export function createDb(databaseUrl: string): Db {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async getRobotIdsForUser(user: string): Promise<string[]> {
      const { rows } = await pool.query(
        `SELECT robot
         FROM user_robots
         WHERE user_id = $1`,
        [user]
      );

      return rows.map(r => r.robot);
    }
  };
}