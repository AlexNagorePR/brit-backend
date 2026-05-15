// src/server/main.ts
import { Issuer } from 'openid-client';
import utils from '@transitive-sdk/utils';

import { loadConfig } from '@/server/config.js';
import { createApp } from '@/server/app.js';

const log = utils.getLogger('main');
log.setLevel('debug');

const config = loadConfig();

async function initializeOIDCClient() {
  const issuer = await Issuer.discover(
    config.cognitoIssuerUrl,
  );

  const oidcClient = new issuer.Client({
    client_id: config.cognitoClientId,
    client_secret: config.cognitoClientSecret,
    redirect_uris: [config.cognitoRedirectUri],
    response_types: ['code'],
  });

  log.info('OIDC client initialized', {
    issuer: issuer.issuer,
    client_id: oidcClient.metadata.client_id,
    redirect_uris: oidcClient.metadata.redirect_uris,
  });

  return oidcClient;
}

async function start() {
  const oidcClient = await initializeOIDCClient();

  const app = createApp({ oidcClient });

  const server = app.listen(config.port, () => {
    console.log(`Server is listening on port ${config.port}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      log.error(`Port ${config.port} is already in use. Stop the process using it or set PORT to match the frontend proxy.`);
      process.exit(1);
    }

    throw err;
  });
}

start().catch((err) => {
  log.error('Failed to start server', err);
  process.exit(1);
});
