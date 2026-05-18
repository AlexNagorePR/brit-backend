import { BuildAuthLogoutUrl } from '@/application/use-cases/auth/build-auth-logout-url.js';
import { CompleteAuthCallback } from '@/application/use-cases/auth/complete-auth-callback.js';
import { StartAuthLogin } from '@/application/use-cases/auth/start-auth-login.js';
import {
  createOidcAuthenticationProvider,
  type OidcClientLike,
} from '@/infrastructure/auth/oidc-authentication-provider.js';
import type { AppConfig } from '@/server/config.js';

export type AuthCompositionDeps = {
  oidcClient?: OidcClientLike;
};

export function composeAuth(config: AppConfig, deps: AuthCompositionDeps = {}) {
  const authenticationProvider = createOidcAuthenticationProvider(config, deps.oidcClient);

  return {
    readCallbackParams: authenticationProvider.readCallbackParams,
    startAuthLogin: new StartAuthLogin(authenticationProvider),
    completeAuthCallback: new CompleteAuthCallback(authenticationProvider, {
      redirectUri: config.cognitoRedirectUri,
    }),
    buildAuthLogoutUrl: new BuildAuthLogoutUrl(authenticationProvider),
  };
}

export type AuthComposition = ReturnType<typeof composeAuth>;
