// src/domain/models/battery.ts

export class Battery {
  private id: string;
  private clientId: string;
  private serialNumber: string;
  private stateOfHealth?: number;
  private createdAt: Date;

  constructor(
    id: string,
    clientId: string,
    serialNumber: string,
    stateOfHealth?: number | null,
    createdAt: Date = new Date(),
  ) {
    this.id = id;
    this.clientId = clientId;
    this.serialNumber = Battery.normalizeSerialNumber(serialNumber);
    this.stateOfHealth = Battery.validateStateOfHealth(stateOfHealth);
    this.createdAt = new Date(createdAt);
  }

  static create(
    clientId: string,
    serialNumber: string,
    stateOfHealth?: number | null
  ): Battery {
    if (!clientId || !clientId.trim()) {
      throw new Error('Client id is required');
    }

    const placeholderId = '';

    return new Battery(
      placeholderId,
      clientId.trim(),
      serialNumber,
      stateOfHealth
    );
  }

  static reconstruct(
    id: string,
    clientId: string,
    serialNumber: string,
    stateOfHealth?: number | null,
    createdAt?: Date
  ): Battery {
    return new Battery(
      id,
      clientId,
      serialNumber,
      stateOfHealth,
      createdAt
    );
  }

  private static normalizeSerialNumber(serialNumber: string): string {
    if (!serialNumber || !serialNumber.trim()) {
      throw new Error('Serial number is required');
    }

    const trimmedSerialNumber = serialNumber.trim();
    return trimmedSerialNumber;
  }

  private static validateStateOfHealth(stateOfHealth?: number | null): number | undefined {
    if (stateOfHealth === undefined || stateOfHealth === null) {
      return undefined;
    }

    if (!Number.isFinite(stateOfHealth) || stateOfHealth < 0 || stateOfHealth > 100) {
      throw new Error('State of health must be between 0 and 100');
    }

    return stateOfHealth;
  }

  getId(): string {
    return this.id;
  }

  getClientId(): string {
    return this.clientId;
  }

  getSerialNumber(): string {
    return this.serialNumber;
  }

  getStateOfHealth(): number | undefined {
    return this.stateOfHealth;
  }

  getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  updateSerialNumber(serialNumber: string): void {
    this.serialNumber = Battery.normalizeSerialNumber(serialNumber);
  }

  updateStateOfHealth(stateOfHealth?: number | null): void {
    this.stateOfHealth = Battery.validateStateOfHealth(stateOfHealth);
  }

  toJSON() {
    return {
      id: this.id,
      clientId: this.clientId,
      serialNumber: this.serialNumber,
      stateOfHealth: this.stateOfHealth,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
