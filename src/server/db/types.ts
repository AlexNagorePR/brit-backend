export type ClientInfo = {
  id: string;
  name: string;
};

export type UserInfo = {
  id: string;
  email: string;
  clientId: string | null;
};

export type RobotInfo = {
  id: string;
  clientId?: string | null;
  hostName: string;
  robotName: string;
  userEmails?: string[];
  deliveryDate?: string;
  lastMaint?: string;
  lastClean?: string;
  lastWork?: string;
  works?: number;
  timeOn?: number;
  timeWork?: number;
};

export type BatteryInfo = {
  id: string;
  clientId: string;
  stateOfHealth?: number | null;
  serialNumber: string;
};

export type WorkInfo = {
  id: string;
  robotId: string;
  startTime?: string;
  endTime?: string;
  estimatedTime?: number;
  totalTime?: number;
  interruptions?: number;
  alarms?: number;
  filePath?: string;
};

export type CleanInfo = {
  id: string;
  robotId: string;
  date: string;
  event: 'Start' | 'End';
};

export type InterruptionInfo = {
  id: string;
  workId: string;
  stateCode: number;
  eventTime?: number;
  returnToAuto?: number;
};

export type WarningInfo = {
  id: string;
  workId: string;
  alarmCode: number;
  eventTime?: number;
};
