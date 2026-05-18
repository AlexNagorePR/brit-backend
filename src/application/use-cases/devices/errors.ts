export class DeviceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceValidationError';
  }
}

export class DeviceAccessDeniedError extends Error {
  constructor(message = 'Device not found') {
    super(message);
    this.name = 'DeviceAccessDeniedError';
  }
}

export class DeviceDataSourceError extends Error {
  constructor(
    readonly source: 'database' | 'portal',
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DeviceDataSourceError';
  }
}
