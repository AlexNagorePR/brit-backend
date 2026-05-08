import { Pool } from 'pg';
import { CleanInfo, InterruptionInfo, WarningInfo } from './types.js';

export function createDataOps(pool: Pool) {
  return {
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
    },
  };
}

export type DataOps = ReturnType<typeof createDataOps>;
