// src/server/app.ts
import express from 'express';
import session from 'express-session';
import FileStoreFactory from 'session-file-store';
import path from 'path';
import fs from 'node:fs';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';

import utils from '@transitive-sdk/utils';
import { loadConfig } from '@/server/config.js';
import {
  createAppComposition,
  type CompositionDeps,
} from '@/server/composition.js';
import { specs } from '@/server/swagger.js';
import { createAuthRouter } from '@/server/routes/auth.js';
import { createApiRouter } from '@/server/routes/api.js';
import { createAdminUsersRouter } from '@/server/routes/admin/users.js';
import { createAdminRobotsRouter } from '@/server/routes/admin/robots.js';
import { createAdminClientsRouter } from '@/server/routes/admin/clients.js';
import { createAdminBatteriesRouter } from '@/server/routes/admin/batteries.js';

const log = utils.getLogger('app');
const FileStore = FileStoreFactory(session);

export function createApp(deps: CompositionDeps = {}) {
  const config = loadConfig();
  const composition = createAppComposition(config, deps);

  const app = express();
  app.use(express.json());

  const isProd = config.nodeEnv === 'production';

  // Enable CORS for Swagger UI (needed for both development and production)
  app.use(
    cors({
      origin: true, // Allow any origin
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  const sessionsDir = path.join(config.varDir, 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });

  const fileStore = new FileStore({
    path: sessionsDir,
    retries: 0,
  });

  composition.collector.start().catch(err => log.error('Collector failed to start', err));

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

  // Middleware to add "Back to App" button to Swagger UI
  const swaggerBackButtonMiddleware = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    const originalSend = res.send;
    res.send = function(data: string | any) {
      if (typeof data === 'string' && data.includes('<!DOCTYPE html>')) {
        const backButtonScript = `
          <style>
            .back-to-app-btn {
              position: fixed;
              top: 20px;
              right: 20px;
              padding: 10px 20px;
              background-color: #4CAF50;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: 600;
              font-size: 14px;
              z-index: 1000;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              transition: background-color 0.3s;
            }
            .back-to-app-btn:hover {
              background-color: #45a049;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            }
          </style>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const button = document.createElement('button');
              button.className = 'back-to-app-btn';
              button.textContent = '← Back to App';
              button.onclick = function() { window.location.href = '/'; };
              document.body.appendChild(button);
            });
          </script>
        `;
        data = data.replace('</body>', backButtonScript + '</body>');
      }
      return originalSend.call(this, data);
    };
    next();
  };

  // Swagger UI
  app.use('/docs', swaggerBackButtonMiddleware, swaggerUi.serve, swaggerUi.setup(specs, { 
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));

  // Register routers
  app.use(
    '/auth',
    createAuthRouter(
      {
        postLoginRedirectUrl: config.postLoginRedirectUrl,
      },
      composition.auth
    )
  );
  app.use('/api', createApiRouter(config, composition.api));
  app.use('/admin/users', createAdminUsersRouter(composition.admin.users));
  app.use('/admin/robots', createAdminRobotsRouter(composition.admin.robots));
  app.use('/admin/clients', createAdminClientsRouter(composition.admin.clients));
  app.use('/admin/batteries', createAdminBatteriesRouter(composition.admin.batteries));

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
