import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine API file patterns based on environment
const isProduction = process.env.NODE_ENV === 'production';
const apiFiles = isProduction
  ? [
      // In production, look for compiled .js files
      path.join(__dirname, 'routes', '*.js'),
      path.join(__dirname, 'routes', 'admin', '*.js'),
    ]
  : [
      // In development, use TypeScript source files with glob pattern
      './src/server/routes/*.ts',
      './src/server/routes/admin/*.ts',
    ];

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
        url: process.env.API_URL || 'https://brit.phenomenonrobotics.com',
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
  apis: apiFiles,
};

export const specs = swaggerJsdoc(options);
