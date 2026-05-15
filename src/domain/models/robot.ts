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
  private userEmails: string[];
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
    userEmails: string[] = [],
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
    this.userEmails = Robot.normalizeUserEmails(userEmails ?? []);
    this.createdAt = new Date(createdAt);
  }

  static create(
    id: string,
    hostName: string,
    robotName: string,
    clientId?: string,
    userEmails: string[] = [],
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
      userEmails
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
    userEmails: string[] = [],
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
      userEmails,
      createdAt
    );
  }

  private static normalizeUserEmails(userEmails: string[]): string[] {
    const normalizedEmails = userEmails
      .map((email) => email.trim().toLowerCase())
      .filter((email) => Boolean(email));

    return [...new Set(normalizedEmails)];
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

  getUserEmails(): string[] {
    return [...this.userEmails];
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

  addUserEmail(email: string): void {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!this.userEmails.includes(trimmedEmail)) {
      this.userEmails.push(trimmedEmail);
    }
  }

  removeUserEmail(email: string): void {
    const trimmedEmail = email.trim().toLowerCase();
    const index = this.userEmails.indexOf(trimmedEmail);
    if (index > -1) {
      this.userEmails.splice(index, 1);
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
      userEmails: [...this.userEmails],
      createdAt: this.createdAt.toISOString(),
    };
  }
}
