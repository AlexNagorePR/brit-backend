import { Pool } from 'pg';
import { WorkInfo } from './types.js';

export function createWorkOps(pool: Pool) {
  return {
    async createWork(robotId: string, data: Partial<WorkInfo>) {
      const startTime = data.startTime ?? null;
      const endTime = data.endTime ?? null;
      const estimatedTime = data.estimatedTime ?? null;
      const totalTime = data.totalTime ?? null;
      const interruptions = data.interruptions ?? 0;
      const alarms = data.alarms ?? 0;
      const filePath = data.filePath ?? null;

      const existing = await pool.query(
        `SELECT id
         FROM work
         WHERE robot_id = $1
           AND start_time IS NOT DISTINCT FROM $2
           AND end_time IS NOT DISTINCT FROM $3
           AND file_path IS NOT DISTINCT FROM $4
         ORDER BY created_at ASC
         LIMIT 1`,
        [
          robotId,
          startTime,
          endTime,
          filePath,
        ]
      );

      if (existing.rows[0]?.id) {
        return existing.rows[0].id;
      }

      const { rows } = await pool.query(
        `INSERT INTO work (robot_id, start_time, end_time, estimated_time, total_time, interruptions, alarms, file_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          robotId,
          startTime,
          endTime,
          estimatedTime,
          totalTime,
          interruptions,
          alarms,
          filePath,
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
  };
}

export type WorkOps = ReturnType<typeof createWorkOps>;
