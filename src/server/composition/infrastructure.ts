import { createCollector } from '@/application/services/collector.js';
import { createCognitoUserIdentityProvider } from '@/infrastructure/auth/cognito-user-identity-provider.js';
import { createDbBatteryRepository } from '@/infrastructure/db/battery-repository.js';
import { createDbClientRepository } from '@/infrastructure/db/client-repository.js';
import { createDb } from '@/infrastructure/db/postgres/index.js';
import { createDbRobotRepository } from '@/infrastructure/db/robot-repository.js';
import { createDbUserRepository } from '@/infrastructure/db/user-repository.js';
import { createPortalApi } from '@/infrastructure/portal/portal-api.js';
import { createTransitiveRobotInfoSubscriber } from '@/infrastructure/transitive/brit-info-robot.js';
import { createTransitiveDeviceCommandPublisher } from '@/infrastructure/transitive/device-command-publisher.js';
import { createTransitiveDeviceTelemetryStream } from '@/infrastructure/transitive/device-data-stream.js';
import { createTransitiveWorkInfoSubscriber } from '@/infrastructure/transitive/brit-info-work.js';
import type { AppConfig } from '@/server/config.js';

export function composeInfrastructure(config: AppConfig) {
  const db = createDb(config.databaseUrl);
  const portalApi = createPortalApi(config);
  const telemetryStream = createTransitiveDeviceTelemetryStream(config);
  const commandPublisher = createTransitiveDeviceCommandPublisher(config);
  const workInfoSubscriber = createTransitiveWorkInfoSubscriber({
    jwtSecret: config.jwtSecret,
    transitiveUser: config.transitiveUser,
    db,
  });
  const robotInfoSubscriber = createTransitiveRobotInfoSubscriber({
    jwtSecret: config.jwtSecret,
    transitiveUser: config.transitiveUser,
    db,
  });

  const clientRepository = createDbClientRepository(db);
  const userRepository = createDbUserRepository(db);
  const robotRepository = createDbRobotRepository(db);
  const batteryRepository = createDbBatteryRepository(db);

  const userIdentityProvider = createCognitoUserIdentityProvider({
    region: config.cognitoRegion,
    userPoolId: config.cognitoUserPoolId,
  });

  const collector = createCollector({
    robotRepository,
    portalApi,
    telemetryStream,
    workInfoSubscriber,
    robotInfoSubscriber,
  });

  return {
    db,
    portalApi,
    telemetryStream,
    commandPublisher,
    workInfoSubscriber,
    robotInfoSubscriber,
    clientRepository,
    userRepository,
    robotRepository,
    batteryRepository,
    userIdentityProvider,
    collector,
  };
}

export type InfrastructureComposition = ReturnType<typeof composeInfrastructure>;
