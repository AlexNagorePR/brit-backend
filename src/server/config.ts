// src/server/config.ts
import dotenv from 'dotenv';
import dotenvExpand from 'dotenv-expand';

dotenvExpand.expand(dotenv.config({ path: './.env' }));

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function get(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v ?? fallback;
}

export type AppConfig = {
  nodeEnv: string;
  port: number;
  varDir: string;

  sessionSecret: string;

  jwtSecret: string;
  transitiveUser: string;

  cognitoClientId: string;
  cognitoClientSecret: string;
  cognitoRedirectUri: string;

  cognitoDomain: string;
  cognitoLogoutUri: string;

  postLoginRedirectUrl: string;

  cognitoIssuerUrl: string;
  cognitoRegion: string;
  cognitoUserPoolId: string;

  databaseUrl: string;
};

export function loadConfig(): AppConfig {
  const nodeEnv = get('NODE_ENV', 'development')!;
  const isProd = nodeEnv === 'production';

  const sessionSecret = isProd ? mustGet('TRANSACT_SESSION_SECRET') : mustGet('TRANSACT_SESSION_SECRET');
  const jwtSecret = isProd ? mustGet('JWT_SECRET') : mustGet('JWT_SECRET');
  const transitiveUser = mustGet('TRANSITIVE_USER');

  const port = Number(get('PORT', '3000'));
  if (!Number.isFinite(port)) throw new Error('PORT must be a number');

  const varDir = get('TRANSACT_VAR_DIR', '/tmp/transact')!;

  return {
    nodeEnv,
    port,
    varDir,

    sessionSecret,

    jwtSecret,
    transitiveUser,

    cognitoClientId: mustGet('COGNITO_CLIENT_ID'),
    cognitoClientSecret: mustGet('COGNITO_CLIENT_SECRET'),
    cognitoRedirectUri: mustGet('COGNITO_REDIRECT_URI'),

    cognitoDomain: mustGet('COGNITO_DOMAIN'),
    cognitoLogoutUri: mustGet('COGNITO_LOGOUT_URI'),

    postLoginRedirectUrl: mustGet('POST_LOGIN_REDIRECT_URL'),

    cognitoIssuerUrl: mustGet('COGNITO_ISSUER_URL'),
    cognitoRegion: mustGet('AWS_REGION'),
    cognitoUserPoolId: mustGet('COGNITO_USER_POOL_ID'),

    databaseUrl: mustGet('DATABASE_URL'),
  };
}