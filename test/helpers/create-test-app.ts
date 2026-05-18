import { createApp } from '@/server/app.js';
import { createAppComposition, type CompositionDeps } from '@/server/composition.js';
import { loadConfig } from '@/server/config.js';

export function createTestApp(deps: CompositionDeps = {}) {
  const config = loadConfig();
  const composition = createAppComposition(config, deps);

  return createApp({ config, composition });
}
