import { Robot } from '@/domain/models/robot.js';
import type {
  RobotDetailsReadModel,
  RobotReadModel,
  RobotRepository,
} from '@/application/ports/robot-repository.js';
import type { Db } from '@/infrastructure/db/postgres/index.js';

type RobotDb = Pick<
  Db,
  | 'getAllRobots'
  | 'getRobotIdsForUser'
  | 'getRobotById'
  | 'updateRobotName'
  | 'updateRobotClient'
  | 'syncRobotsSnapshot'
  | 'getUsersForRobot'
  | 'setUsersForRobot'
>;

export function createDbRobotRepository(db: RobotDb): RobotRepository {
  return {
    list(): Promise<RobotReadModel[]> {
      return db.getAllRobots();
    },

    listForUser(userEmail: string): Promise<RobotReadModel[]> {
      return db.getRobotIdsForUser(userEmail);
    },

    findById(robotId: string): Promise<RobotDetailsReadModel | null> {
      return db.getRobotById(robotId);
    },

    updateName(robotId: string, name: string): Promise<void> {
      return db.updateRobotName(robotId, name);
    },

    updateClient(robotId: string, clientId?: string): Promise<void> {
      return db.updateRobotClient(robotId, clientId ?? null);
    },

    syncSnapshot(robots: Robot[]): Promise<void> {
      return db.syncRobotsSnapshot(
        robots.map((robot) => ({
          id: robot.getId(),
          clientId: robot.getClientId(),
          hostName: robot.getHostName(),
          robotName: robot.getRobotName(),
        }))
      );
    },

    listUsers(robotId: string): Promise<string[]> {
      return db.getUsersForRobot(robotId);
    },

    setUsers(robotId: string, userEmails: string[]): Promise<void> {
      return db.setUsersForRobot(robotId, userEmails);
    },
  };
}
