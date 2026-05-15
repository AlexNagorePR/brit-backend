import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BRIT Backend API',
      version: '1.0.0',
      description: 'API documentation for BRIT Backend',
      contact: {
        name: 'BRIT Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://brit.phenomenonrobotics.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie from OIDC authentication',
        },
      },
    },
    security: [{ sessionCookie: [] }],
  },
  apis: [
    './src/server/routes/auth.ts',
    './src/server/routes/api.ts',
    './src/server/routes/admin/users.ts',
    './src/server/routes/admin/clients.ts',
    './src/server/routes/admin/robots.ts',
    './src/server/routes/admin/batteries.ts',
  ],
};

export const specs = swaggerJsdoc(options);
