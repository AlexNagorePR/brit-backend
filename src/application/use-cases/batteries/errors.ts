export class BatteryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BatteryValidationError';
  }
}

export class BatteryNotFoundError extends Error {
  constructor(readonly id: string) {
    super('Battery not found');
    this.name = 'BatteryNotFoundError';
  }
}

export class ClientNotFoundError extends Error {
  constructor(readonly clientId: string) {
    super('Client not found');
    this.name = 'ClientNotFoundError';
  }
}
