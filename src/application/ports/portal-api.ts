export type PortalRobotInfoResponse = Record<string, {
  clientId?: string | null;
  os?: {
    hostname?: string;
  };
} | null | undefined>;

export type PortalRunningRobotDetails = {
  id: string;
  data: Record<string, any>;
};

export interface PortalApi {
  listRobotInfo(): Promise<PortalRobotInfoResponse>;
  listRunningRobots(): Promise<Record<string, any>>;
  listRunningRobotDetails(robotIds: string[]): Promise<PortalRunningRobotDetails[]>;
}
