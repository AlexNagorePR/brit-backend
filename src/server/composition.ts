import { composeAdmin } from '@/server/composition/admin.js';
import { composeApi } from '@/server/composition/api.js';
import { composeAuth, type AuthCompositionDeps } from '@/server/composition/auth.js';
import { composeInfrastructure } from '@/server/composition/infrastructure.js';
import type { AppConfig } from '@/server/config.js';

export type CompositionDeps = AuthCompositionDeps;

export function createAppComposition(config: AppConfig, deps: CompositionDeps = {}) {
  const infrastructure = composeInfrastructure(config);

  return {
    db: infrastructure.db,
    collector: infrastructure.collector,
    auth: composeAuth(config, deps),
    api: composeApi(infrastructure),
    admin: composeAdmin(infrastructure),
  };
}

export type AppComposition = ReturnType<typeof createAppComposition>;
