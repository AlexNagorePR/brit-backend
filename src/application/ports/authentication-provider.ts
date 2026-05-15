export type AuthLoginChallenge = {
  state: string;
  nonce: string;
  createdAt: number;
};

export type AuthCallbackParams = {
  state?: string;
  error?: string;
  [key: string]: unknown;
};

export type AuthCallbackChecks = {
  state: string;
  nonce: string;
};

export type AuthenticatedIdentity = {
  subject: string;
  email?: string;
  groups: string[];
  claims: Record<string, unknown>;
};

export interface AuthenticationProvider {
  createLoginChallenge(): AuthLoginChallenge;
  createAuthorizationUrl(challenge: AuthLoginChallenge): string;
  readCallbackParams(request: unknown): AuthCallbackParams;
  completeCallback(input: {
    redirectUri: string;
    params: AuthCallbackParams;
    checks: AuthCallbackChecks;
  }): Promise<AuthenticatedIdentity>;
  createLogoutUrl(): string;
}
