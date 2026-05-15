export class UserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserValidationError';
  }
}

export class UserNotFoundError extends Error {
  constructor(readonly id: string) {
    super('User not found');
    this.name = 'UserNotFoundError';
  }
}
