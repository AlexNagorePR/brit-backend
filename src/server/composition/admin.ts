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
import { GetClient } from '@/application/use-cases/clients/get-client.js';
import { ListClients } from '@/application/use-cases/clients/list-clients.js';
import { GetRobot } from '@/application/use-cases/robots/get-robot.js';
import { ListRobots } from '@/application/use-cases/robots/list-robots.js';
import { ListRobotUsers } from '@/application/use-cases/robots/list-robot-users.js';
import { SetRobotUsers } from '@/application/use-cases/robots/set-robot-users.js';
import { SyncRobotsFromPortal } from '@/application/use-cases/robots/sync-robots-from-portal.js';
import { UpdateRobotClientByName } from '@/application/use-cases/robots/update-robot-client-by-name.js';
import { CreateIdentityUserAndLocalUser } from '@/application/use-cases/users/create-identity-user-and-local-user.js';
import { CreateUser } from '@/application/use-cases/users/create-user.js';
import { DeleteIdentityUserAndLocalUser } from '@/application/use-cases/users/delete-identity-user-and-local-user.js';
import { DeleteUser } from '@/application/use-cases/users/delete-user.js';
import { FindUserById } from '@/application/use-cases/users/find-user-by-id.js';
import { GetIdentityUser } from '@/application/use-cases/users/get-identity-user.js';
import { ListUsers } from '@/application/use-cases/users/list-users.js';
import { ListUsersForClientByName } from '@/application/use-cases/users/list-users-for-client-by-name.js';
import { ListUsersWithIdentitySync } from '@/application/use-cases/users/list-users-with-identity-sync.js';
import { SetIdentityUserEnabled } from '@/application/use-cases/users/set-identity-user-enabled.js';
import { SyncIdentityUsersFromProvider } from '@/application/use-cases/users/sync-identity-users-from-provider.js';
import { UpdateIdentityUserGroups } from '@/application/use-cases/users/update-identity-user-groups.js';
import { UpdateUserClient } from '@/application/use-cases/users/update-user-client.js';
import type { InfrastructureComposition } from './infrastructure.js';

export function composeAdmin(infrastructure: InfrastructureComposition) {
  const {
    batteryRepository,
    clientRepository,
    portalApi,
    robotRepository,
    userIdentityProvider,
    userRepository,
  } = infrastructure;

  const findClientById = new FindClientById(clientRepository);
  const createUser = new CreateUser(userRepository);
  const deleteUser = new DeleteUser(userRepository);
  const findUserById = new FindUserById(userRepository);

  return {
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
      getRobot: new GetRobot(robotRepository),
      listRobots: new ListRobots(robotRepository),
      listRobotUsers: new ListRobotUsers(robotRepository),
      setRobotUsers: new SetRobotUsers(robotRepository),
      syncRobotsFromPortal: new SyncRobotsFromPortal(portalApi, robotRepository),
      updateRobotClientByName: new UpdateRobotClientByName(clientRepository, robotRepository),
    },

    users: {
      createIdentityUserAndLocalUser: new CreateIdentityUserAndLocalUser(userIdentityProvider, createUser),
      deleteIdentityUserAndLocalUser: new DeleteIdentityUserAndLocalUser(userIdentityProvider, deleteUser),
      getIdentityUser: new GetIdentityUser(userIdentityProvider),
      listUsers: new ListUsers(userRepository),
      listUsersForClientByName: new ListUsersForClientByName(clientRepository, userRepository),
      listUsersWithIdentitySync: new ListUsersWithIdentitySync(userIdentityProvider, userRepository),
      setIdentityUserEnabled: new SetIdentityUserEnabled(userIdentityProvider),
      syncIdentityUsersFromProvider: new SyncIdentityUsersFromProvider(userIdentityProvider, userRepository),
      updateIdentityUserGroups: new UpdateIdentityUserGroups(userIdentityProvider, findUserById, findClientById),
      updateUserClient: new UpdateUserClient(userRepository),
    },
  };
}

export type AdminComposition = ReturnType<typeof composeAdmin>;
