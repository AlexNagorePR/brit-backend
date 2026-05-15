export class ClientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClientValidationError';
  }
}

export class ClientNotFoundError extends Error {
  constructor(readonly id: string) {
    super('Client not found');
    this.name = 'ClientNotFoundError';
  }
}
