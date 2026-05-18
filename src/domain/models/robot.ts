// src/domain/models/robot.ts

/**
 * Robot domain model
 */
export class Robot {
  private id: string;
  private hostName: string;
  private robotName: string;
  private clientId?: string;
  private deliveryDate?: string;
  private lastMaintenanceDate?: string;
  private lastCleanDate?: string;
  private lastWorkDate?: string;
  private worksPerformed?: number;
  private timeInOperation?: number;
  private timeWorking?: number;
  private userIds: string[];
  private createdAt: Date;

  constructor(
    id: string,
    hostName: string,
    robotName: string,
    clientId?: string,
    deliveryDate?: string,
    lastMaintenanceDate?: string,
    lastCleanDate?: string,
    lastWorkDate?: string,
    worksPerformed?: number,
    timeInOperation?: number,
    timeWorking?: number,
    userIds: string[] = [],
    createdAt: Date = new Date(),
  ) {
    this.id = id;
    this.hostName = hostName;
    this.robotName = robotName;
    this.clientId = clientId;
    this.deliveryDate = deliveryDate;
    this.lastMaintenanceDate = lastMaintenanceDate;
    this.lastCleanDate = lastCleanDate;
    this.lastWorkDate = lastWorkDate;
    this.worksPerformed = worksPerformed;
    this.timeInOperation = timeInOperation;
    this.timeWorking = timeWorking;
    this.userIds = Robot.normalizeUserIds(userIds ?? []);
    this.createdAt = new Date(createdAt);
  }

  static create(
    id: string,
    hostName: string,
    robotName: string,
    clientId?: string,
    userIds: string[] = [],
    deliveryDate?: string,
    lastMaintenanceDate?: string,
    lastCleanDate?: string,
    lastWorkDate?: string,
    worksPerformed?: number,
    timeInOperation?: number,
    timeWorking?: number
  ): Robot {
    if (!hostName || !hostName.trim()) {
      throw new Error('Host name is required');
    }
    if (!robotName || !robotName.trim()) {
      throw new Error('Robot name is required');
    }

    return new Robot(
      id,
      hostName.trim(),
      robotName.trim(),
      clientId,
      deliveryDate,
      lastMaintenanceDate,
      lastCleanDate,
      lastWorkDate,
      worksPerformed,
      timeInOperation,
      timeWorking,
      userIds
    );
  }

  /**
   * Factory method to reconstruct from database
   */
  static reconstruct(
    id: string,
    hostName: string,
    robotName: string,
    clientId?: string,
    deliveryDate?: string,
    lastMaintenanceDate?: string,
    lastCleanDate?: string,
    lastWorkDate?: string,
    worksPerformed?: number,
    timeInOperation?: number,
    timeWorking?: number,
    userIds: string[] = [],
    createdAt?: Date
  ): Robot {
    return new Robot(
      id,
      hostName,
      robotName,
      clientId,
      deliveryDate,
      lastMaintenanceDate,
      lastCleanDate,
      lastWorkDate,
      worksPerformed,
      timeInOperation,
      timeWorking,
      userIds,
      createdAt
    );
  }

  private static normalizeUserIds(userIds: string[]): string[] {
    const normalizedIds = userIds
      .map((userId) => userId.trim())
      .filter((userId) => Boolean(userId));

    return [...new Set(normalizedIds)];
  }

  getId(): string {
    return this.id;
  }

  getClientId(): string | undefined {
    return this.clientId;
  }

  getHostName(): string {
    return this.hostName;
  }

  getRobotName(): string {
    return this.robotName;
  }

  getUserIds(): string[] {
    return [...this.userIds];
  }

  getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  getDeliveryDate(): string | undefined {
    return this.deliveryDate;
  }

  getLastMaintenanceDate(): string | undefined {
    return this.lastMaintenanceDate;
  }

  getLastCleanDate(): string | undefined {
    return this.lastCleanDate;
  }

  getLastWorkDate(): string | undefined {
    return this.lastWorkDate;
  }

  getWorksPerformed(): number | undefined {
    return this.worksPerformed;
  }

  getTimeInOperation(): number | undefined {
    return this.timeInOperation;
  }

  getTimeWorking(): number | undefined {
    return this.timeWorking;
  }

  updateRobotName(newName: string): void {
    if (!newName || !newName.trim()) {
      throw new Error('Robot name is required');
    }
    this.robotName = newName.trim();
  }

  addUserId(userId: string): void {
    if (!userId || !userId.trim()) {
      throw new Error('User id is required');
    }
    const trimmedUserId = userId.trim();
    if (!this.userIds.includes(trimmedUserId)) {
      this.userIds.push(trimmedUserId);
    }
  }

  removeUserId(userId: string): void {
    const trimmedUserId = userId.trim();
    const index = this.userIds.indexOf(trimmedUserId);
    if (index > -1) {
      this.userIds.splice(index, 1);
    }
  }

  toJSON() {
    return {
      id: this.id,
      clientId: this.clientId,
      hostName: this.hostName,
      robotName: this.robotName,
      deliveryDate: this.deliveryDate,
      lastMaintenanceDate: this.lastMaintenanceDate,
      lastCleanDate: this.lastCleanDate,
      lastWorkDate: this.lastWorkDate,
      worksPerformed: this.worksPerformed,
      timeInOperation: this.timeInOperation,
      timeWorking: this.timeWorking,
      userIds: [...this.userIds],
      createdAt: this.createdAt.toISOString(),
    };
  }
}
