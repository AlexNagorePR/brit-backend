import { Issuer } from 'openid-client';
import type { OidcClientLike } from '@/infrastructure/auth/oidc-authentication-provider.js';

type OidcClientConfig = {
  cognitoIssuerUrl: string;
  cognitoClientId: string;
  cognitoClientSecret: string;
  cognitoRedirectUri: string;
};

export type OidcClientInitialization = {
  oidcClient: OidcClientLike;
  info: {
    issuer: string;
    clientId: string | undefined;
    redirectUris: string[] | undefined;
  };
};

export async function createOidcClient(config: OidcClientConfig): Promise<OidcClientInitialization> {
  const issuer = await Issuer.discover(config.cognitoIssuerUrl);

  const oidcClient = new issuer.Client({
    client_id: config.cognitoClientId,
    client_secret: config.cognitoClientSecret,
    redirect_uris: [config.cognitoRedirectUri],
    response_types: ['code'],
  });

  return {
    oidcClient,
    info: {
      issuer: typeof issuer.issuer === 'string' ? issuer.issuer : config.cognitoIssuerUrl,
      clientId: config.cognitoClientId,
      redirectUris: [config.cognitoRedirectUri],
    },
  };
}
