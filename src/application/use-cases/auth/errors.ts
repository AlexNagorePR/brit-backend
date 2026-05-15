export class AuthProviderUnavailableError extends Error {
  constructor() {
    super('OIDC client not initialized');
    this.name = 'AuthProviderUnavailableError';
  }
}

export class AuthCallbackRejectedError extends Error {
  constructor(public readonly oidcError: string) {
    super(`OIDC error: ${oidcError}`);
    this.name = 'AuthCallbackRejectedError';
  }
}

export class InvalidAuthStateError extends Error {
  constructor(public readonly state?: string) {
    super('Invalid/expired state. Please try again.');
    this.name = 'InvalidAuthStateError';
  }
}

export class ExpiredAuthStateError extends Error {
  constructor(public readonly state: string) {
    super('Login expired. Please try again.');
    this.name = 'ExpiredAuthStateError';
  }
}
