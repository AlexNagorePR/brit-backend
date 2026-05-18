export class RobotValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RobotValidationError';
  }
}

export class RobotNotFoundError extends Error {
  constructor(readonly id: string) {
    super('Robot not found');
    this.name = 'RobotNotFoundError';
  }
}

export class RobotAccessDeniedError extends Error {
  constructor(message = 'Robot not found') {
    super(message);
    this.name = 'RobotAccessDeniedError';
  }
}
