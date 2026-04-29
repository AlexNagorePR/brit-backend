// src/server/db.ts
import { Pool } from 'pg';

export type ClientInfo = {
  id: string;
  name: string;
};

export type UserInfo = {
  id: string;
  email: string;
  clientId: string;
};

export type RobotInfo = {
  id: string;
  clientId: string;
  hostName: string;
  robotName: string;
  userEmails?: string[];
  deliveryDate?: string;
  lastMaint?: string;
  lastClean?: string;
  lastWork?: string;
  works?: number;
  timeOn?: number;
  timeWork?: number;
};

export type BatteryInfo = {
  id: string;
  clientId: string;
  stateOfHealth?: number;
  serialNumber?: string;
};

export type WorkInfo = {
  id: string;
  robotId: string;
  startTime?: string;
  endTime?: string;
  estimatedTime?: number;
  totalTime?: number;
  interruptions?: number;
  alarms?: number;
  filePath?: string;
};

export type CleanInfo = {
  id: string;
  robotId: string;
  date: string;
  event: 'Start' | 'End';
};

export type InterruptionInfo = {
  id: string;
  workId: string;
  stateCode: number;
  eventTime?: number;
  returnToAuto?: number;
};

export type WarningInfo = {
  id: string;
  workId: string;
  alarmCode: number;
  eventTime?: number;
};

export type Db = {
  // Client operations
  createClient(name: string): Promise<string>;
  getClient(id: string): Promise<ClientInfo | null>;
  getAllClients(): Promise<ClientInfo[]>;
  deleteClient(id: string): Promise<void>;
  getClientByName(name: string): Promise<ClientInfo | null>;

  // User operations
  createUser(userId: string, email: string, clientId?: string): Promise<string>;
  deleteUser(id: string): Promise<void>;
  getUserByEmail(email: string): Promise<UserInfo | null>;
  getUserById(id: string): Promise<UserInfo | null>;
  getUsersByClient(clientId: string): Promise<UserInfo[]>;
  getAllUsers(): Promise<UserInfo[]>;
  updateUserClient(userId: string, clientId: string): Promise<void>;
  syncUsersSnapshot(clientId: string, emails: string[]): Promise<void>;
  syncCognitoUsers(users: { username: string; email: string }[]): Promise<void>;

  // Robot operations
  getRobotIdsForUser(email: string): Promise<RobotInfo[]>;
  getRobotsForClient(clientId: string): Promise<RobotInfo[]>;
  getAllRobots(): Promise<RobotInfo[]>;
  upsertRobot(clientId: string, hostName: string, robotName: string): Promise<void>;
  updateRobotClient(robotId: string, clientId: string | null): Promise<void>;
  updateRobotName(id: string, name: string): Promise<void>;
  deleteRobot(id: string): Promise<void>;
  syncRobotsSnapshot(clientId: string, robots: RobotInfo[]): Promise<void>;
  
  // User-Robot relationships
  addUserToRobot(userId: string, robotId: string): Promise<void>;
  removeUserFromRobot(userId: string, robotId: string): Promise<void>;
  setUsersForRobot(robotId: string, userIds: string[]): Promise<void>;
  getUsersForRobot(robotId: string): Promise<string[]>;

  // Battery operations
  createBattery(clientId: string, serialNumber?: string, stateOfHealth?: number): Promise<string>;
  getBatteriesForClient(clientId: string): Promise<BatteryInfo[]>;
  updateBattery(id: string, updates: Partial<BatteryInfo>): Promise<void>;
  deleteBattery(id: string): Promise<void>;
  addUserToBattery(userId: string, batteryId: string): Promise<void>;
  removeUserFromBattery(userId: string, batteryId: string): Promise<void>;
  getBatteriesForUser(userId: string): Promise<BatteryInfo[]>;

  // Work operations
  createWork(robotId: string, data: Partial<WorkInfo>): Promise<string>;
  getWorksForRobot(robotId: string): Promise<WorkInfo[]>;
  updateWork(id: string, updates: Partial<WorkInfo>): Promise<void>;
  deleteWork(id: string): Promise<void>;

  // Clean operations
  createClean(robotId: string, date: string, event: 'Start' | 'End'): Promise<string>;
  getCleansForRobot(robotId: string): Promise<CleanInfo[]>;
  deleteClean(id: string): Promise<void>;

  // Interruption operations
  createInterruption(workId: string, stateCode: number, eventTime?: number, returnToAuto?: number): Promise<string>;
  getInterruptionsForWork(workId: string): Promise<InterruptionInfo[]>;
  deleteInterruption(id: string): Promise<void>;

  // Warning operations
  createWarning(workId: string, alarmCode: number, eventTime?: number): Promise<string>;
  getWarningsForWork(workId: string): Promise<WarningInfo[]>;
  deleteWarning(id: string): Promise<void>;
};

export function createDb(databaseUrl: string): Db {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    // Client operations
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

    // User operations
    async getUserByEmail(email: string) {
      const { rows } = await pool.query(
        `SELECT id, email, client_id
         FROM "user"
         WHERE email = $1`,
        [email]
      );
      if (!rows[0]) return null;
      return {
        id: rows[0].id,
        email: rows[0].email,
        clientId: rows[0].client_id,
      };
    },

    async getUserById(id: string) {
      const { rows } = await pool.query(
        `SELECT id, email, client_id
         FROM "user"
         WHERE id = $1`,
        [id]
      );
      if (!rows[0]) return null;
      return {
        id: rows[0].id,
        email: rows[0].email,
        clientId: rows[0].client_id,
      };
    },

    async getUsersByClient(clientId: string) {
      const { rows } = await pool.query(
        `SELECT id, email, client_id
         FROM "user"
         WHERE client_id = $1
         ORDER BY email ASC`,
        [clientId]
      );
      return rows.map(r => ({
        id: r.id,
        email: r.email,
        clientId: r.client_id,
      }));
    },

    async getAllUsers() {
      const { rows } = await pool.query(
        `SELECT id, email, client_id
         FROM "user"
         ORDER BY email ASC`
      );
      return rows.map(r => ({
        id: r.id,
        email: r.email,
        clientId: r.client_id,
      }));
    },

    // Robot operations
    async getRobotsForClient(clientId: string) {
      const { rows } = await pool.query(
        `SELECT id, client_id, host_name, robot_name, delivery_date, last_mant, last_clean, last_work, works, time_on, time_work
         FROM robot
         WHERE client_id = $1
         ORDER BY created_at ASC`,
        [clientId]
      );
      return rows.map(r => ({
        id: r.id,
        clientId: r.client_id,
        hostName: r.host_name,
        robotName: r.robot_name,
        deliveryDate: r.delivery_date,
        lastMaint: r.last_mant,
        lastClean: r.last_clean,
        lastWork: r.last_work,
        works: r.works,
        timeOn: r.time_on,
        timeWork: r.time_work,
      }));
    },

    async getRobotIdsForUser(email: string) {
      const { rows } = await pool.query(
        `SELECT r.id, r.host_name, r.robot_name, r.client_id
         FROM user_robot ur
         JOIN robot r ON r.id = ur.robot_id
         JOIN "user" u ON u.id = ur.user_id
         WHERE u.email = $1`,
        [email]
      );

      return rows.map(r => ({
        id: r.id,
        clientId: r.client_id,
        hostName: r.host_name,
        robotName: r.robot_name,
      }));
    },

    async createUser(userId: string, email: string, clientId?: string) {
      const { rows } = await pool.query(
        `INSERT INTO "user" (id, email, client_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (id)
        DO UPDATE SET
          email = EXCLUDED.email,
          client_id = COALESCE(EXCLUDED.client_id, "user".client_id)
        RETURNING id`,
        [userId, email, clientId ?? null]
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

    async updateUserClient(userId: string, clientId: string) {
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

        // Log the sync operation
        console.log(`[syncUsersSnapshot] Starting sync for clientId: ${clientId} with ${emails.length} emails`);

        // Insert or update users from Cognito
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

        // Get current users before deletion
        const currentUsers = await client.query(
          `SELECT id, email, client_id FROM "user" WHERE client_id = $1`,
          [clientId]
        );
        console.log(`[syncUsersSnapshot] Current users in DB for client ${clientId}:`, currentUsers.rows);

        // Delete users that are not in the Cognito list
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
          console.log(`[syncUsersSnapshot] Deleted ${deleteResult.rowCount} users not in Cognito:`, deleteResult.rows);
        }

        // Verify final state
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

    async syncCognitoUsers(users: { username: string; email: string }[]) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        for (const { username, email } of users) {
          await client.query(
            `INSERT INTO "user" (id, email)
            VALUES ($1, $2)
            ON CONFLICT (id)
            DO UPDATE SET
              email = EXCLUDED.email
            RETURNING id`,
            [username, email]
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

    async getAllRobots() {
      const { rows } = await pool.query(
        `SELECT r.id, r.host_name, r.robot_name, r.client_id, c.name as client_name,
                COALESCE(array_agg(DISTINCT u.email ORDER BY u.email) FILTER (WHERE u.email IS NOT NULL), ARRAY[]::text[]) as user_emails
         FROM robot r
         LEFT JOIN user_robot ur ON r.id = ur.robot_id
         LEFT JOIN "user" u ON ur.user_id = u.id
         LEFT JOIN client c ON r.client_id = c.id
         GROUP BY r.id, r.host_name, r.robot_name, r.client_id, c.name
         ORDER BY r.created_at ASC`
      );

      return rows.map(r => ({
        id: r.id,
        clientId: r.client_id,
        clientName: r.client_name,
        hostName: r.host_name,
        robotName: r.robot_name,
        userEmails: r.user_emails,
      }));
    },

    async upsertRobot(clientId: string, hostName: string, robotName: string) {
      await pool.query(
        `INSERT INTO robot (client_id, host_name, robot_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (host_name)
         DO UPDATE SET robot_name = EXCLUDED.robot_name`,
        [clientId, hostName, robotName]
      );
    },

    async updateRobotClient(robotId: string, clientId: string) {
      await pool.query(
        `UPDATE robot
         SET client_id = $2
         WHERE id = $1`,
        [robotId, clientId]
      );
    },

    async updateRobotName(id: string, name: string) {
      await pool.query(
        `UPDATE robot
         SET robot_name = $2
         WHERE id = $1`,
        [id, name]
      );
    },

    async deleteRobot(id: string) {
      await pool.query(
        `DELETE FROM robot
         WHERE id = $1`,
        [id]
      );
    },

    async syncRobotsSnapshot(clientId: string, robots: RobotInfo[]) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        for (const robot of robots) {
          await client.query(
            `INSERT INTO robot (id, client_id, host_name, robot_name)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (host_name)
             DO UPDATE SET robot_name = EXCLUDED.robot_name`,
            [robot.id, clientId, robot.hostName, robot.robotName]
          );
        }

        const hostNames = robots.map(r => r.hostName);

        if (hostNames.length === 0) {
          await client.query(`DELETE FROM robot WHERE client_id = $1`, [clientId]);
        } else {
          await client.query(
            `DELETE FROM robot
             WHERE client_id = $1 AND host_name NOT IN (
               SELECT UNNEST($2::text[])
             )`,
            [clientId, hostNames]
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

    async addUserToRobot(robotId: string, userId: string) {
      await pool.query(
        `INSERT INTO user_robot (user_id, robot_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, robot_id) DO NOTHING`,
        [userId, robotId]
      );
    },

    async removeUserFromRobot(robotId: string, userId: string) {
      await pool.query(
        `DELETE FROM user_robot
        WHERE user_id = $1 AND robot_id = $2`,
        [userId, robotId]
      );
    },

    async getUsersForRobot(robotId: string) {
      const { rows } = await pool.query(
        `SELECT u.email
        FROM user_robot ur
        JOIN "user" u ON ur.user_id = u.id
        WHERE ur.robot_id = $1
        ORDER BY u.email ASC`,
        [robotId]
      );

      return rows.map(r => r.email);
    },

    async setUsersForRobot(robotId: string, userEmails: string[]) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await client.query(
          `DELETE FROM user_robot
          WHERE robot_id = $1`,
          [robotId]
        );

        for (const email of userEmails) {
          await client.query(
            `INSERT INTO user_robot (user_id, robot_id)
            SELECT id, $2
            FROM "user"
            WHERE email = $1
            ON CONFLICT (user_id, robot_id) DO NOTHING`,
            [email, robotId]
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

    // Battery operations
    async createBattery(clientId: string, serialNumber?: string, stateOfHealth?: number) {
      const { rows } = await pool.query(
        `INSERT INTO battery (client_id, serial_number, state_of_health)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [clientId, serialNumber || null, stateOfHealth || null]
      );
      return rows[0].id;
    },

    async getBatteriesForClient(clientId: string) {
      const { rows } = await pool.query(
        `SELECT id, client_id, state_of_health, serial_number
         FROM battery
         WHERE client_id = $1
         ORDER BY created_at ASC`,
        [clientId]
      );
      return rows.map(r => ({
        id: r.id,
        clientId: r.client_id,
        stateOfHealth: r.state_of_health,
        serialNumber: r.serial_number,
      }));
    },

    async updateBattery(id: string, updates: Partial<BatteryInfo>) {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.stateOfHealth !== undefined) {
        fields.push(`state_of_health = $${paramCount++}`);
        values.push(updates.stateOfHealth);
      }
      if (updates.serialNumber !== undefined) {
        fields.push(`serial_number = $${paramCount++}`);
        values.push(updates.serialNumber);
      }

      if (fields.length === 0) return;

      values.push(id);
      await pool.query(
        `UPDATE battery SET ${fields.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    },

    async deleteBattery(id: string) {
      await pool.query(
        `DELETE FROM battery WHERE id = $1`,
        [id]
      );
    },

    // User-Battery relationships
    async addUserToBattery(userId: string, batteryId: string) {
      await pool.query(
        `INSERT INTO user_battery (user_id, battery_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, battery_id) DO NOTHING`,
        [userId, batteryId]
      );
    },

    async removeUserFromBattery(userId: string, batteryId: string) {
      await pool.query(
        `DELETE FROM user_battery
         WHERE user_id = $1 AND battery_id = $2`,
        [userId, batteryId]
      );
    },

    async getBatteriesForUser(userId: string) {
      const { rows } = await pool.query(
        `SELECT b.id, b.client_id, b.state_of_health, b.serial_number
         FROM user_battery ub
         JOIN battery b ON b.id = ub.battery_id
         WHERE ub.user_id = $1
         ORDER BY b.created_at ASC`,
        [userId]
      );
      return rows.map(r => ({
        id: r.id,
        clientId: r.client_id,
        stateOfHealth: r.state_of_health,
        serialNumber: r.serial_number,
      }));
    },

    // Work operations
    async createWork(robotId: string, data: Partial<WorkInfo>) {
      const { rows } = await pool.query(
        `INSERT INTO work (robot_id, start_time, end_time, estimated_time, total_time, interruptions, alarms, file_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          robotId,
          data.startTime || null,
          data.endTime || null,
          data.estimatedTime || null,
          data.totalTime || null,
          data.interruptions || 0,
          data.alarms || 0,
          data.filePath || null,
        ]
      );
      return rows[0].id;
    },

    async getWorksForRobot(robotId: string) {
      const { rows } = await pool.query(
        `SELECT id, robot_id, start_time, end_time, estimated_time, total_time, interruptions, alarms, file_path
         FROM work
         WHERE robot_id = $1
         ORDER BY created_at ASC`,
        [robotId]
      );
      return rows.map(r => ({
        id: r.id,
        robotId: r.robot_id,
        startTime: r.start_time,
        endTime: r.end_time,
        estimatedTime: r.estimated_time,
        totalTime: r.total_time,
        interruptions: r.interruptions,
        alarms: r.alarms,
        filePath: r.file_path,
      }));
    },

    async updateWork(id: string, updates: Partial<WorkInfo>) {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.startTime !== undefined) {
        fields.push(`start_time = $${paramCount++}`);
        values.push(updates.startTime);
      }
      if (updates.endTime !== undefined) {
        fields.push(`end_time = $${paramCount++}`);
        values.push(updates.endTime);
      }
      if (updates.estimatedTime !== undefined) {
        fields.push(`estimated_time = $${paramCount++}`);
        values.push(updates.estimatedTime);
      }
      if (updates.totalTime !== undefined) {
        fields.push(`total_time = $${paramCount++}`);
        values.push(updates.totalTime);
      }
      if (updates.interruptions !== undefined) {
        fields.push(`interruptions = $${paramCount++}`);
        values.push(updates.interruptions);
      }
      if (updates.alarms !== undefined) {
        fields.push(`alarms = $${paramCount++}`);
        values.push(updates.alarms);
      }
      if (updates.filePath !== undefined) {
        fields.push(`file_path = $${paramCount++}`);
        values.push(updates.filePath);
      }

      if (fields.length === 0) return;

      values.push(id);
      await pool.query(
        `UPDATE work SET ${fields.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    },

    async deleteWork(id: string) {
      await pool.query(
        `DELETE FROM work WHERE id = $1`,
        [id]
      );
    },

    // Clean operations
    async createClean(robotId: string, date: string, event: 'Start' | 'End') {
      const { rows } = await pool.query(
        `INSERT INTO clean (robot_id, date, event)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [robotId, date, event]
      );
      return rows[0].id;
    },

    async getCleansForRobot(robotId: string) {
      const { rows } = await pool.query(
        `SELECT id, robot_id, date, event
         FROM clean
         WHERE robot_id = $1
         ORDER BY date ASC`,
        [robotId]
      );
      return rows.map(r => ({
        id: r.id,
        robotId: r.robot_id,
        date: r.date,
        event: r.event,
      }));
    },

    async deleteClean(id: string) {
      await pool.query(
        `DELETE FROM clean WHERE id = $1`,
        [id]
      );
    },

    // Interruption operations
    async createInterruption(workId: string, stateCode: number, eventTime?: number, returnToAuto?: number) {
      const { rows } = await pool.query(
        `INSERT INTO interruption (work_id, state_code, event_time, return_to_auto)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [workId, stateCode, eventTime || null, returnToAuto || null]
      );
      return rows[0].id;
    },

    async getInterruptionsForWork(workId: string) {
      const { rows } = await pool.query(
        `SELECT id, work_id, state_code, event_time, return_to_auto
         FROM interruption
         WHERE work_id = $1
         ORDER BY created_at ASC`,
        [workId]
      );
      return rows.map(r => ({
        id: r.id,
        workId: r.work_id,
        stateCode: r.state_code,
        eventTime: r.event_time,
        returnToAuto: r.return_to_auto,
      }));
    },

    async deleteInterruption(id: string) {
      await pool.query(
        `DELETE FROM interruption WHERE id = $1`,
        [id]
      );
    },

    // Warning operations
    async createWarning(workId: string, alarmCode: number, eventTime?: number) {
      const { rows } = await pool.query(
        `INSERT INTO warning (work_id, alarm_code, event_time)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [workId, alarmCode, eventTime || null]
      );
      return rows[0].id;
    },

    async getWarningsForWork(workId: string) {
      const { rows } = await pool.query(
        `SELECT id, work_id, alarm_code, event_time
         FROM warning
         WHERE work_id = $1
         ORDER BY created_at ASC`,
        [workId]
      );
      return rows.map(r => ({
        id: r.id,
        workId: r.work_id,
        alarmCode: r.alarm_code,
        eventTime: r.event_time,
      }));
    },

    async deleteWarning(id: string) {
      await pool.query(
        `DELETE FROM warning WHERE id = $1`,
        [id]
      );
    }
  };
}