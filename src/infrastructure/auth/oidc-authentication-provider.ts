import { generators } from 'openid-client';
import type {
  AuthenticationProvider,
  AuthCallbackParams,
  AuthenticatedIdentity,
  AuthLoginChallenge,
} from '@/application/ports/authentication-provider.js';
import { AuthProviderUnavailableError } from '@/application/use-cases/auth/errors.js';

export type OidcClientLike = {
  authorizationUrl(args: Record<string, unknown>): string;
  callbackParams(request: unknown): Record<string, unknown>;
  callback(
    redirectUri: string,
    params: AuthCallbackParams,
    checks: { nonce: string; state: string }
  ): Promise<{ claims(): Record<string, unknown> }>;
};

type OidcAuthenticationProviderConfig = {
  cognitoClientId: string;
  cognitoDomain: string;
  cognitoLogoutUri: string;
};

export function createOidcAuthenticationProvider(
  config: OidcAuthenticationProviderConfig,
  oidcClient?: OidcClientLike
): AuthenticationProvider {
  function requireClient(): OidcClientLike {
    if (!oidcClient) {
      throw new AuthProviderUnavailableError();
    }

    return oidcClient;
  }

  return {
    createLoginChallenge(): AuthLoginChallenge {
      return {
        state: generators.state(),
        nonce: generators.nonce(),
        createdAt: Date.now(),
      };
    },

    createAuthorizationUrl(challenge: AuthLoginChallenge): string {
      return requireClient().authorizationUrl({
        scope: 'email openid phone',
        state: challenge.state,
        nonce: challenge.nonce,
      });
    },

    readCallbackParams(request: unknown): AuthCallbackParams {
      return normalizeCallbackParams(requireClient().callbackParams(request));
    },

    async completeCallback(input): Promise<AuthenticatedIdentity> {
      const tokenSet = await requireClient().callback(
        input.redirectUri,
        input.params,
        input.checks
      );

      const claims = tokenSet.claims();

      return {
        subject: getStringClaim(claims, 'sub') || '',
        email: getStringClaim(claims, 'email'),
        groups: getStringArrayClaim(claims, 'cognito:groups'),
        claims,
      };
    },

    createLogoutUrl(): string {
      return (
        `https://${config.cognitoDomain}/logout` +
        `?client_id=${encodeURIComponent(config.cognitoClientId)}` +
        `&logout_uri=${encodeURIComponent(config.cognitoLogoutUri)}`
      );
    },
  };
}

function normalizeCallbackParams(params: Record<string, unknown>): AuthCallbackParams {
  return {
    ...params,
    state: getStringClaim(params, 'state'),
    error: getStringClaim(params, 'error'),
  };
}

function getStringClaim(claims: Record<string, unknown>, key: string): string | undefined {
  const value = claims[key];
  return typeof value === 'string' ? value : undefined;
}

function getStringArrayClaim(claims: Record<string, unknown>, key: string): string[] {
  const value = claims[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}
