// src/server/app.ts
import express from 'express';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import path from 'path';
import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';

import utils from '@transitive-sdk/utils';
import { loadConfig } from '@/server/config.js';
import { createDb } from '@/server/db.js';
import { createCognitoAdminService } from './cognito-admin.js';
import { createCollector } from '@/server/collector.js';
import { specs } from '@/server/swagger.js';
import { createAuthRouter } from '@/server/routes/auth.js';
import { createApiRouter } from '@/server/routes/api.js';
import { createAdminUsersRouter } from '@/server/routes/admin/users.js';
import { createAdminRobotsRouter } from '@/server/routes/admin/robots.js';
import { createAdminClientsRouter } from '@/server/routes/admin/clients.js';
import { createAdminBatteriesRouter } from '@/server/routes/admin/batteries.js';

const log = utils.getLogger('app');
const FileStore = FileStoreFactory(session);

type OidcClientLike = {
  authorizationUrl(args: any): string;
  callbackParams(req: any): any;
  callback(redirectUri: string, params: any, checks: any): Promise<{ claims(): any }>;
};

export function createApp(deps: { oidcClient?: OidcClientLike } = {}) {
  const config = loadConfig();
  const { oidcClient } = deps;

  const app = express();
  app.use(express.json());

  const isProd = config.nodeEnv === 'production';

  const sessionsDir = path.join(config.varDir, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const fileStore = new FileStore({
    path: sessionsDir,
    retries: 0,
  });

  const db = createDb(config.databaseUrl);

  const collector = createCollector({
    db,
    jwtSecret: config.jwtSecret,
    transitiveUser: config.transitiveUser,
  });

  collector.start().catch(err => log.error('Collector failed to start', err));

  const cognitoAdmin = createCognitoAdminService({
    region: config.cognitoRegion,
    userPoolId: config.cognitoUserPoolId,
  });

  app.use(
    session({
      name: 'connect.sid',
      store: fileStore,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: isProd,
      cookie: {
        maxAge: 3 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: isProd ? 'lax' : 'lax',
        secure: isProd,
      },
    })
  );

  // Swagger UI
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(specs, { 
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));

  // Register routers
  app.use('/auth', createAuthRouter(config, oidcClient));
  app.use('/api', createApiRouter(config, db));
  app.use('/admin/users', createAdminUsersRouter(config, db, cognitoAdmin));
  app.use('/admin/robots', createAdminRobotsRouter(config, db));
  app.use('/admin/clients', createAdminClientsRouter(config, db));
  app.use('/admin/batteries', createAdminBatteriesRouter(config, db));

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      service: 'transact-backend',
      status: 'running',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}