import { Pool } from 'pg';

export type RobotInfo = {
  id: string;
  name: string;
};

export type Db = {
  getRobotIdsForUser(user: string): Promise<RobotInfo[]>;
};

export function createDb(databaseUrl: string): Db {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    async getRobotIdsForUser(user: string): Promise<RobotInfo[]> {
      const { rows } = await pool.query(
        `SELECT r.robot_id, r.robot_name
         FROM user_robots ur
         JOIN robots r ON r.robot_id = ur.robot_id
         WHERE user_id = $1`,
        [user]
      );

      return rows.map(r => ({
        id: r.robot_id,
        name: r.robot_name,
      }));
    }
  };
}