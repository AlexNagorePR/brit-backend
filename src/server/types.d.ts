// src/server/types.d.ts
import 'express-session';
import type { AuthLoginChallenge } from '@/application/ports/authentication-provider.js';
import type { AccountLike } from '@/server/auth.js';

declare module '@transitive-sdk/utils';

declare module 'express-session' {
  interface SessionData {
    user?: AccountLike | null;

    oidc?: {
      pending?: Record<string, AuthLoginChallenge>;
    } | null;
  }
}
