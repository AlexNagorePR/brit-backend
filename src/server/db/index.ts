import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

import { createClientOps, ClientOps } from './client.js';
import { createUserOps, UserOps } from './user.js';
import { createRobotOps, RobotOps } from './robot.js';
import { createBatteryOps, BatteryOps } from './battery.js';
import { createWorkOps, WorkOps } from './work.js';
import { createDataOps, DataOps } from './data.js';
import {
  ClientInfo,
  UserInfo,
  RobotInfo,
  BatteryInfo,
  WorkInfo,
  CleanInfo,
  InterruptionInfo,
  WarningInfo,
} from './types.js';

export type Db = ClientOps & UserOps & RobotOps & BatteryOps & WorkOps & DataOps;

export type {
  ClientInfo,
  UserInfo,
  RobotInfo,
  BatteryInfo,
  WorkInfo,
  CleanInfo,
  InterruptionInfo,
  WarningInfo,
};

export function createDb(databaseUrl: string): Db {
  const isLocalDB =
    databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

  const sslConfig = isLocalDB
    ? false
    : {
        rejectUnauthorized: true,
        ca: fs.readFileSync(
          process.env.RDS_CA_PATH || path.join(process.cwd(), 'global-bundle.pem'),
          'utf-8'
        ),
      };

  const pool = new Pool({ connectionString: databaseUrl, ssl: sslConfig });

  return {
    ...createClientOps(pool),
    ...createUserOps(pool),
    ...createRobotOps(pool),
    ...createBatteryOps(pool),
    ...createWorkOps(pool),
    ...createDataOps(pool),
  };
}
