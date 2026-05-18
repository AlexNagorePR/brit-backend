import { Robot } from '@/domain/models/robot.js';

export type RobotReadModel = {
  id: string;
  clientId?: string | null;
  hostName?: string;
  robotName?: string;
  clientName?: string | null;
  userIds?: string[];
  [key: string]: unknown;
};

export type RobotDetailsReadModel = RobotReadModel & {
  works?: unknown[];
  cleans?: unknown[];
};

export interface RobotRepository {
  list(): Promise<RobotReadModel[]>;
  listForUser(userId: string): Promise<RobotReadModel[]>;
  findById(robotId: string): Promise<RobotDetailsReadModel | null>;
  updateName(robotId: string, name: string): Promise<void>;
  updateClient(robotId: string, clientId?: string): Promise<void>;
  syncSnapshot(robots: Robot[]): Promise<void>;
  listUsers(robotId: string): Promise<string[]>;
  setUsers(robotId: string, userIds: string[]): Promise<void>;
}
