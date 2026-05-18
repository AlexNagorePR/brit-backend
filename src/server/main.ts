import utils from '@transitive-sdk/utils';

import { loadConfig } from '@/server/config.js';
import { createApp } from '@/server/app.js';
import { createAppComposition } from '@/server/composition.js';
import { createOidcClient } from '@/infrastructure/auth/oidc-client.js';

const log = utils.getLogger('main');
log.setLevel('debug');

const config = loadConfig();

async function start() {
  const { oidcClient, info } = await createOidcClient(config);

  log.info('OIDC client initialized', {
    issuer: info.issuer,
    client_id: info.clientId,
    redirect_uris: info.redirectUris,
  });

  const composition = createAppComposition(config, { oidcClient });
  const app = createApp({ config, composition });

  composition.collector.start().catch(err => log.error('Collector failed to start', err));

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
