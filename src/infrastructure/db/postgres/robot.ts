import { Pool } from 'pg';
import { RobotInfo, WorkInfo, InterruptionInfo, WarningInfo, CleanInfo } from './types.js';
import { Robot } from '@/domain/models/robot.js';

function toRobotInfo(robot: Robot, options: { includeUserEmails?: boolean } = {}): RobotInfo {
  const info: RobotInfo = {
    id: robot.getId(),
    clientId: robot.getClientId() ?? null,
    hostName: robot.getHostName(),
    robotName: robot.getRobotName(),
  };

  if (options.includeUserEmails) {
    info.userEmails = robot.getUserEmails();
  }

  return info;
}

function reconstructRobot(row: any, userEmails: string[] = []): Robot {
  return Robot.reconstruct(
    row.id,
    row.host_name,
    row.robot_name,
    row.client_id ?? undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    userEmails
  );
}

function reconstructRobotUsers(robotId: string, userEmails: string[]): Robot {
  return Robot.reconstruct(
    robotId,
    '',
    '',
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    userEmails
  );
}

export function createRobotOps(pool: Pool) {
  return {
    async getRobotIdsForUser(email: string) {
      const { rows } = await pool.query(
        `SELECT r.id, r.host_name, r.robot_name, r.client_id
         FROM user_robot ur
         JOIN robot r ON r.id = ur.robot_id
         JOIN "user" u ON u.id = ur.user_id
         WHERE u.email = $1`,
        [email]
      );

      return rows.map(r => toRobotInfo(reconstructRobot(r)));
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
        ...toRobotInfo(
          reconstructRobot(r, r.user_emails),
          { includeUserEmails: true }
        ),
        clientName: r.client_name,
      }));
    },

    async getRobotById(robotId: string) {
      const { rows } = await pool.query(
        `SELECT r.id, r.client_id, r.host_name, r.robot_name, c.name as client_name,
                COALESCE(array_agg(DISTINCT u.email ORDER BY u.email) FILTER (WHERE u.email IS NOT NULL), ARRAY[]::text[]) as user_emails
         FROM robot r
         LEFT JOIN user_robot ur ON r.id = ur.robot_id
         LEFT JOIN "user" u ON ur.user_id = u.id
         LEFT JOIN client c ON r.client_id = c.id
         WHERE r.id = $1
         GROUP BY r.id, r.client_id, r.host_name, r.robot_name, c.name`,
        [robotId]
      );

      if (!rows[0]) return null;

      const r = rows[0];

      const worksRes = await pool.query(
        `SELECT id, robot_id, start_time, end_time, estimated_time, total_time, interruptions, alarms, file_path
         FROM work
         WHERE robot_id = $1
         ORDER BY created_at ASC`,
        [robotId]
      );

      const cleansRes = await pool.query(
        `SELECT id, robot_id, date, event
         FROM clean
         WHERE robot_id = $1
         ORDER BY date ASC`,
        [robotId]
      );

      const works = worksRes.rows.map((w: any) => ({
        id: w.id,
        robotId: w.robot_id,
        startTime: w.start_time,
        endTime: w.end_time,
        estimatedTime: w.estimated_time,
        totalTime: w.total_time,
        interruptions: w.interruptions,
        alarms: w.alarms,
        filePath: w.file_path,
      }));

      const workIds = worksRes.rows.map((w: any) => w.id);

      let interruptionsByWork: Record<string, InterruptionInfo[]> = {};
      let warningsByWork: Record<string, WarningInfo[]> = {};

      if (workIds.length > 0) {
        const interruptionsRes = await pool.query(
          `SELECT id, work_id, state_code, event_time, return_to_auto
           FROM interruption
           WHERE work_id = ANY($1)
           ORDER BY created_at ASC`,
          [workIds]
        );

        for (const row of interruptionsRes.rows) {
          const item: InterruptionInfo = {
            id: row.id,
            workId: row.work_id,
            stateCode: row.state_code,
            eventTime: row.event_time,
            returnToAuto: row.return_to_auto,
          };
          interruptionsByWork[row.work_id] ||= [];
          interruptionsByWork[row.work_id].push(item);
        }

        const warningsRes = await pool.query(
          `SELECT id, work_id, alarm_code, event_time
           FROM warning
           WHERE work_id = ANY($1)
           ORDER BY created_at ASC`,
          [workIds]
        );

        for (const row of warningsRes.rows) {
          const item: WarningInfo = {
            id: row.id,
            workId: row.work_id,
            alarmCode: row.alarm_code,
            eventTime: row.event_time,
          };
          warningsByWork[row.work_id] ||= [];
          warningsByWork[row.work_id].push(item);
        }
      }

      const worksWithDetails = works.map(w => ({
        ...w,
        interruptions: interruptionsByWork[w.id] || [],
        warnings: warningsByWork[w.id] || [],
      }));

      const cleans = cleansRes.rows.map((c: any) => ({
        id: c.id,
        robotId: c.robot_id,
        date: c.date,
        event: c.event,
      }));

      const robot = reconstructRobot(r, r.user_emails);

      return {
        ...toRobotInfo(robot, { includeUserEmails: true }),
        clientName: r.client_name,
        works: worksWithDetails,
        cleans,
      };
    },

    async updateRobotClient(robotId: string, clientId: string | null) {
      await pool.query(
        `UPDATE robot
         SET client_id = $2
         WHERE id = $1`,
        [robotId, clientId]
      );
    },

    async updateRobotName(id: string, name: string) {
      const robot = Robot.create(id, 'host-placeholder', name);

      await pool.query(
        `UPDATE robot
         SET robot_name = $2
         WHERE id = $1`,
        [robot.getId(), robot.getRobotName()]
      );
    },

    async updateRobotInfo(id: string, updates: Partial<RobotInfo>) {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updates.lastClean !== undefined) {
        fields.push(`last_clean = $${paramCount++}`);
        values.push(updates.lastClean);
      }
      if (updates.lastWork !== undefined) {
        fields.push(`last_work = $${paramCount++}`);
        values.push(updates.lastWork);
      }
      if (updates.works !== undefined) {
        fields.push(`works = $${paramCount++}`);
        values.push(updates.works);
      }
      if (updates.timeOn !== undefined) {
        fields.push(`time_on = $${paramCount++}`);
        values.push(updates.timeOn);
      }
      if (updates.timeWork !== undefined) {
        fields.push(`time_work = $${paramCount++}`);
        values.push(updates.timeWork);
      }

      if (fields.length === 0) return;

      values.push(id);
      await pool.query(
        `UPDATE robot SET ${fields.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    },

    async syncRobotsSnapshot(robots: RobotInfo[]) {
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const domainRobots = robots.map(robot => Robot.create(
          robot.id,
          robot.hostName,
          robot.robotName,
          robot.clientId ?? undefined,
          robot.userEmails ?? []
        ));

        console.log(`Starting sync with ${domainRobots.length} robots:`, domainRobots.map(r => ({ id: r.getId(), hostName: r.getHostName() })));

        for (const robot of domainRobots) {
          console.log(`Upserting robot ${robot.getHostName()} with id ${robot.getId()}`);
          const result = await client.query(
            `INSERT INTO robot (id, host_name, robot_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (id)
             DO NOTHING
             RETURNING id`,
            [robot.getId(), robot.getHostName(), robot.getRobotName()]
          );
          if (result.rows.length === 0) {
            console.log(`  → Conflict detected, robot ${robot.getId()} already exists (DO NOTHING)`);
          } else {
            console.log(`  → Robot ${robot.getId()} inserted successfully`);
          }
        }

        const hostnames = domainRobots.map(r => r.getHostName());
        console.log(`Deleting robots NOT in: [${hostnames.join(', ')}]`);
        const deleteResult = await client.query(
          `DELETE FROM robot
          WHERE host_name NOT IN (SELECT UNNEST($1::text[]))
          RETURNING id, host_name, robot_name`,
          [hostnames]
        );
        if (deleteResult.rows.length > 0) {
          console.log(`  → Deleted ${deleteResult.rows.length} robots:`, deleteResult.rows);
        } else {
          console.log(`  → No robots deleted`);
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
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

      const robot = reconstructRobotUsers(robotId, rows.map(r => r.email));
      return robot.getUserEmails();
    },

    async setUsersForRobot(robotId: string, userEmails: string[]) {
      const robot = reconstructRobotUsers(robotId, userEmails);
      const normalizedUserEmails = robot.getUserEmails();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        await client.query(
          `DELETE FROM user_robot
          WHERE robot_id = $1`,
          [robotId]
        );

        for (const email of normalizedUserEmails) {
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
  };
}

export type RobotOps = ReturnType<typeof createRobotOps>;
