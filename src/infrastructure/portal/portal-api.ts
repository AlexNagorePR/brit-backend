import type {
  PortalApi,
  PortalRobotInfoResponse,
  PortalRunningRobotDetails,
} from '@/application/ports/portal-api.js';
import { fetchPortalApi, signPortalApiJWT } from '@/server/portal.js';

const ROBOT_AGENT_API =
  'https://portal.transitiverobotics.com/@transitive-robotics/_robot-agent/api/v1';

type PortalApiConfig = {
  jwtSecret: string;
  transitiveUser: string;
};

export function createPortalApi(config: PortalApiConfig): PortalApi {
  function signToken(): string {
    return signPortalApiJWT({
      jwtSecret: config.jwtSecret,
      transitiveUser: config.transitiveUser,
      validitySeconds: 60,
    });
  }

  function listRunningRobotsWithToken(token: string): Promise<Record<string, any>> {
    return fetchPortalApi<Record<string, any>>(
      token,
      `${ROBOT_AGENT_API}/running/`,
      { timeoutMs: 14000 }
    );
  }

  return {
    listRobotInfo(): Promise<PortalRobotInfoResponse> {
      const token = signToken();
      return fetchPortalApi<PortalRobotInfoResponse>(
        token,
        `${ROBOT_AGENT_API}/info/`,
        { timeoutMs: 14000 }
      );
    },

    listRunningRobots(): Promise<Record<string, any>> {
      return listRunningRobotsWithToken(signToken());
    },

    async listRunningRobotDetails(robotIds: string[]): Promise<PortalRunningRobotDetails[]> {
      const token = signToken();
      const runningRobots = await listRunningRobotsWithToken(token);
      const runningIds = new Set(Object.keys(runningRobots || {}));

      return Promise.all(
        robotIds
          .filter((robotId) => runningIds.has(robotId))
          .map(async (robotId) => ({
            id: robotId,
            data: await fetchPortalApi<Record<string, any>>(
              token,
              `${ROBOT_AGENT_API}/running/${encodeURIComponent(robotId)}`,
              { timeoutMs: 14000 }
            ),
          }))
      );
    },
  };
}
