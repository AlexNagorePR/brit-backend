import { Battery } from '@/domain/models/battery.js';
import type { BatteryRepository, BatteryUser } from '@/application/ports/battery-repository.js';
import type { Db } from '@/infrastructure/db/postgres/index.js';

type BatteryDb = Pick<
  Db,
  | 'createBattery'
  | 'getBatteriesForClient'
  | 'getBattery'
  | 'updateBattery'
  | 'deleteBattery'
  | 'setUsersForBattery'
  | 'getUsersForBattery'
>;

function toDomainBattery(battery: {
  id: string;
  clientId: string;
  serialNumber: string;
  stateOfHealth?: number | null;
}): Battery {
  return Battery.reconstruct(
    battery.id,
    battery.clientId,
    battery.serialNumber,
    battery.stateOfHealth
  );
}

export function createDbBatteryRepository(db: BatteryDb): BatteryRepository {
  return {
    create(battery: Battery): Promise<string> {
      return db.createBattery(
        battery.getClientId(),
        battery.getSerialNumber(),
        battery.getStateOfHealth()
      );
    },

    async listForClient(clientId: string): Promise<Battery[]> {
      const batteries = await db.getBatteriesForClient(clientId);
      return batteries.map(toDomainBattery);
    },

    async findById(id: string): Promise<Battery | null> {
      const battery = await db.getBattery(id);
      return battery ? toDomainBattery(battery) : null;
    },

    updateSerialNumber(id: string, serialNumber: string): Promise<void> {
      return db.updateBattery(id, { serialNumber });
    },

    delete(id: string): Promise<void> {
      return db.deleteBattery(id);
    },

    setUsers(id: string, userIds: string[]): Promise<void> {
      return db.setUsersForBattery(id, userIds);
    },

    listUsers(id: string): Promise<BatteryUser[]> {
      return db.getUsersForBattery(id);
    },
  };
}
