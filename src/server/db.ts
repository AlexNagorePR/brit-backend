// src/server/db.ts
// Re-export everything from the db module for backward compatibility
export {
  type Db,
  type ClientInfo,
  type UserInfo,
  type RobotInfo,
  type BatteryInfo,
  type WorkInfo,
  type CleanInfo,
  type InterruptionInfo,
  type WarningInfo,
  createDb,
} from './db/index.js';
