import { BuildAuthLogoutUrl } from '@/application/use-cases/auth/build-auth-logout-url.js';
import { CompleteAuthCallback } from '@/application/use-cases/auth/complete-auth-callback.js';
import { StartAuthLogin } from '@/application/use-cases/auth/start-auth-login.js';
import { CreateBattery } from '@/application/use-cases/batteries/create-battery.js';
import { DeleteBattery } from '@/application/use-cases/batteries/delete-battery.js';
import { GetBattery } from '@/application/use-cases/batteries/get-battery.js';
import { ListBatteriesForClient } from '@/application/use-cases/batteries/list-batteries-for-client.js';
import { ListBatteryUsers } from '@/application/use-cases/batteries/list-battery-users.js';
import { SetBatteryUsers } from '@/application/use-cases/batteries/set-battery-users.js';
import { UpdateBatterySerialNumber } from '@/application/use-cases/batteries/update-battery-serial-number.js';
import { CreateClient } from '@/application/use-cases/clients/create-client.js';
import { DeleteClient } from '@/application/use-cases/clients/delete-client.js';
import { FindClientById } from '@/application/use-cases/clients/find-client-by-id.js';
import { FindClientByName } from '@/application/use-cases/clients/find-client-by-name.js';
import { GetClient } from '@/application/use-cases/clients/get-client.js';
import { ListClients } from '@/application/use-cases/clients/list-clients.js';
import { ListRunningDevices } from '@/application/use-cases/devices/list-running-devices.js';
import { GetRobot } from '@/application/use-cases/robots/get-robot.js';
import { ListRobots } from '@/application/use-cases/robots/list-robots.js';
import { ListRobotsForUser } from '@/application/use-cases/robots/list-robots-for-user.js';
import { ListRobotUsers } from '@/application/use-cases/robots/list-robot-users.js';
import { SetRobotUsers } from '@/application/use-cases/robots/set-robot-users.js';
import { SyncRobotsFromPortal } from '@/application/use-cases/robots/sync-robots-from-portal.js';
import { UpdateRobotClient } from '@/application/use-cases/robots/update-robot-client.js';
import { UpdateRobotName } from '@/application/use-cases/robots/update-robot-name.js';
import { CreateUser } from '@/application/use-cases/users/create-user.js';
import { DeleteUser } from '@/application/use-cases/users/delete-user.js';
import { FindUserById } from '@/application/use-cases/users/find-user-by-id.js';
import { ListUsers } from '@/application/use-cases/users/list-users.js';
import { ListUsersByClient } from '@/application/use-cases/users/list-users-by-client.js';
import { SyncIdentityUsers } from '@/application/use-cases/users/sync-identity-users.js';
import { UpdateUserClient } from '@/application/use-cases/users/update-user-client.js';
import {
  createOidcAuthenticationProvider,
  type OidcClientLike,
} from '@/infrastructure/auth/oidc-authentication-provider.js';
import { createCognitoUserIdentityProvider } from '@/infrastructure/auth/cognito-user-identity-provider.js';
import { createDbBatteryRepository } from '@/infrastructure/db/battery-repository.js';
import { createDbClientRepository } from '@/infrastructure/db/client-repository.js';
import { createDbRobotRepository } from '@/infrastructure/db/robot-repository.js';
import { createDbUserRepository } from '@/infrastructure/db/user-repository.js';
import { createPortalApi } from '@/infrastructure/portal/portal-api.js';
import { createTransitiveDeviceCommandPublisher } from '@/infrastructure/transitive/device-command-publisher.js';
import { createTransitiveDeviceTelemetryStream } from '@/infrastructure/transitive/device-data-stream.js';
import { createTransitiveRobotInfoSubscriber } from '@/infrastructure/transitive/brit-info-robot.js';
import { createTransitiveWorkInfoSubscriber } from '@/infrastructure/transitive/brit-info-work.js';
import type { AppConfig } from '@/server/config.js';
import { createCollector } from '@/application/services/collector.js';
import { createDb } from '@/infrastructure/db/postgres/index.js';

export type CompositionDeps = {
  oidcClient?: OidcClientLike;
};

export function createAppComposition(config: AppConfig, deps: CompositionDeps = {}) {
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
  const authenticationProvider = createOidcAuthenticationProvider(config, deps.oidcClient);

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

  const findClientById = new FindClientById(clientRepository);
  const findClientByName = new FindClientByName(clientRepository);
  const listRobotsForUser = new ListRobotsForUser(robotRepository);

  return {
    db,
    collector,

    auth: {
      readCallbackParams: authenticationProvider.readCallbackParams,
      startAuthLogin: new StartAuthLogin(authenticationProvider),
      completeAuthCallback: new CompleteAuthCallback(authenticationProvider, {
        redirectUri: config.cognitoRedirectUri,
      }),
      buildAuthLogoutUrl: new BuildAuthLogoutUrl(authenticationProvider),
    },

    api: {
      listRunningDevices: new ListRunningDevices(portalApi),
      listRobotsForUser,
      updateRobotName: new UpdateRobotName(robotRepository),
      telemetryStream,
      commandPublisher,
    },

    admin: {
      batteries: {
        createBattery: new CreateBattery({
          batteryRepository,
          clientRepository,
        }),
        listBatteriesForClient: new ListBatteriesForClient(batteryRepository),
        getBattery: new GetBattery(batteryRepository),
        updateBatterySerialNumber: new UpdateBatterySerialNumber(batteryRepository),
        deleteBattery: new DeleteBattery(batteryRepository),
        setBatteryUsers: new SetBatteryUsers(batteryRepository),
        listBatteryUsers: new ListBatteryUsers(batteryRepository),
      },

      clients: {
        listClients: new ListClients(clientRepository),
        createClient: new CreateClient(clientRepository),
        getClient: new GetClient(clientRepository),
        deleteClient: new DeleteClient(clientRepository),
      },

      robots: {
        findClientByName,
        getRobot: new GetRobot(robotRepository),
        listRobots: new ListRobots(robotRepository),
        listRobotUsers: new ListRobotUsers(robotRepository),
        setRobotUsers: new SetRobotUsers(robotRepository),
        syncRobotsFromPortal: new SyncRobotsFromPortal(portalApi, robotRepository),
        updateRobotClient: new UpdateRobotClient(robotRepository),
      },

      users: {
        userIdentityProvider,
        findClientById,
        findClientByName,
        createUser: new CreateUser(userRepository),
        deleteUser: new DeleteUser(userRepository),
        findUserById: new FindUserById(userRepository),
        listUsers: new ListUsers(userRepository),
        listUsersByClient: new ListUsersByClient(userRepository),
        syncIdentityUsers: new SyncIdentityUsers(userRepository),
        updateUserClient: new UpdateUserClient(userRepository),
      },
    },
  };
}

export type AppComposition = ReturnType<typeof createAppComposition>;
