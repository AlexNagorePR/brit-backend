import { Pool } from 'pg';
import { BatteryInfo } from './types.js';
import { Battery } from '@/domain/models/battery.js';

function toBatteryInfo(battery: Battery): BatteryInfo {
  return {
    id: battery.getId(),
    clientId: battery.getClientId(),
    stateOfHealth: battery.getStateOfHealth() ?? null,
    serialNumber: battery.getSerialNumber(),
  };
}

function reconstructBattery(row: any): Battery {
  return Battery.reconstruct(
    row.id,
    row.client_id,
    row.serial_number,
    row.state_of_health
  );
}

export function createBatteryOps(pool: Pool) {
  return {
    async createBattery(clientId: string, serialNumber: string, stateOfHealth?: number) {
      const battery = Battery.create(clientId, serialNumber, stateOfHealth);

      const { rows } = await pool.query(
        `INSERT INTO battery (client_id, serial_number, state_of_health)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [battery.getClientId(), battery.getSerialNumber(), battery.getStateOfHealth() ?? null]
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
      return rows.map(r => toBatteryInfo(reconstructBattery(r)));
    },

    async getBattery(id: string) {
      const { rows } = await pool.query(
        `SELECT id, client_id, state_of_health, serial_number
         FROM battery
         WHERE id = $1`,
        [id]
      );
      if (!rows[0]) return null;

      return toBatteryInfo(reconstructBattery(rows[0]));
    },

    async updateBattery(id: string, updates: Partial<BatteryInfo>) {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.stateOfHealth !== undefined) {
        const battery = Battery.create('client-placeholder', 'serial-placeholder', updates.stateOfHealth);
        fields.push(`state_of_health = $${paramCount++}`);
        values.push(battery.getStateOfHealth() ?? null);
      }
      if (updates.serialNumber !== undefined) {
        const battery = Battery.create('client-placeholder', updates.serialNumber);
        fields.push(`serial_number = $${paramCount++}`);
        values.push(battery.getSerialNumber());
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

    async removeUserFromBattery(userId: string, batteryId: string) {
      await pool.query(
        `DELETE FROM user_battery
         WHERE user_id = $1 AND battery_id = $2`,
        [userId, batteryId]
      );
    },

    async setUsersForBattery(batteryId: string, userIds: string[]) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        // Delete all current users from battery
        await client.query(
          `DELETE FROM user_battery WHERE battery_id = $1`,
          [batteryId]
        );

        // Add new users to battery
        for (const userId of userIds) {
          await client.query(
            `INSERT INTO user_battery (user_id, battery_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, battery_id) DO NOTHING`,
            [userId, batteryId]
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

    async getBatteriesForUser(userId: string) {
      const { rows } = await pool.query(
        `SELECT b.id, b.client_id, b.state_of_health, b.serial_number
         FROM user_battery ub
         JOIN battery b ON b.id = ub.battery_id
         WHERE ub.user_id = $1
         ORDER BY b.created_at ASC`,
        [userId]
      );
      return rows.map(r => toBatteryInfo(reconstructBattery(r)));
    },

    async getUsersForBattery(batteryId: string) {
      const { rows } = await pool.query(
        `SELECT u.id, u.email
         FROM user_battery ub
         JOIN "user" u ON ub.user_id = u.id
         WHERE ub.battery_id = $1
         ORDER BY u.email ASC`,
        [batteryId]
      );
      return rows.map(r => ({
        id: r.id,
        email: r.email,
      }));
    },
  };
}

export type BatteryOps = ReturnType<typeof createBatteryOps>;
