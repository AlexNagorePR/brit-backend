import { describe, it, expect, vi } from 'vitest';
import { Battery } from '@/domain/models/battery.js';
import { BatteryNotFoundError, BatteryValidationError } from '@/application/use-cases/batteries/errors.js';
import { DeleteBattery } from '@/application/use-cases/batteries/delete-battery.js';
import { GetBattery } from '@/application/use-cases/batteries/get-battery.js';
import { ListBatteriesForClient } from '@/application/use-cases/batteries/list-batteries-for-client.js';
import { ListBatteryUsers } from '@/application/use-cases/batteries/list-battery-users.js';
import { SetBatteryUsers } from '@/application/use-cases/batteries/set-battery-users.js';
import { UpdateBatterySerialNumber } from '@/application/use-cases/batteries/update-battery-serial-number.js';

describe('Battery use cases', () => {
  it('lists batteries for a client', async () => {
    const repository = {
      listForClient: vi.fn().mockResolvedValue([
        Battery.reconstruct('battery-1', 'client-1', 'SN-001', 95),
      ]),
    };
    const useCase = new ListBatteriesForClient(repository as any);

    const result = await useCase.execute({ clientId: ' client-1 ' });

    expect(repository.listForClient).toHaveBeenCalledWith('client-1');
    expect(result).toEqual([
      {
        id: 'battery-1',
        clientId: 'client-1',
        serialNumber: 'SN-001',
        stateOfHealth: 95,
      },
    ]);
  });

  it('rejects list query without client id', async () => {
    const useCase = new ListBatteriesForClient({ listForClient: vi.fn() } as any);

    await expect(useCase.execute({ clientId: '' })).rejects.toThrow(BatteryValidationError);
  });

  it('gets one battery', async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(Battery.reconstruct('battery-1', 'client-1', 'SN-001')),
    };
    const useCase = new GetBattery(repository as any);

    const result = await useCase.execute('battery-1');

    expect(repository.findById).toHaveBeenCalledWith('battery-1');
    expect(result).toEqual({
      id: 'battery-1',
      clientId: 'client-1',
      serialNumber: 'SN-001',
      stateOfHealth: null,
    });
  });

  it('throws when battery is not found', async () => {
    const useCase = new GetBattery({ findById: vi.fn().mockResolvedValue(null) } as any);

    await expect(useCase.execute('battery-1')).rejects.toThrow(BatteryNotFoundError);
  });

  it('updates serial number', async () => {
    const repository = {
      updateSerialNumber: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new UpdateBatterySerialNumber(repository as any);

    const result = await useCase.execute({
      id: 'battery-1',
      serialNumber: ' SN-002 ',
    });

    expect(repository.updateSerialNumber).toHaveBeenCalledWith('battery-1', 'SN-002');
    expect(result).toEqual({
      id: 'battery-1',
      serialNumber: 'SN-002',
    });
  });

  it('deletes a battery', async () => {
    const repository = {
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new DeleteBattery(repository as any);

    const result = await useCase.execute('battery-1');

    expect(repository.delete).toHaveBeenCalledWith('battery-1');
    expect(result).toEqual({ id: 'battery-1' });
  });

  it('sets battery users', async () => {
    const repository = {
      setUsers: vi.fn().mockResolvedValue(undefined),
    };
    const useCase = new SetBatteryUsers(repository as any);
    const userIds = ['user-1', 'user-2'];

    const result = await useCase.execute({ id: 'battery-1', userIds });

    expect(repository.setUsers).toHaveBeenCalledWith('battery-1', userIds);
    expect(result).toEqual({ batteryId: 'battery-1', userIds });
  });

  it('rejects invalid battery users input', async () => {
    const useCase = new SetBatteryUsers({ setUsers: vi.fn() } as any);

    await expect(useCase.execute({ id: 'battery-1', userIds: 'user-1' })).rejects.toThrow(BatteryValidationError);
  });

  it('lists battery users', async () => {
    const users = [{ id: 'user-1', email: 'user@example.com' }];
    const repository = {
      listUsers: vi.fn().mockResolvedValue(users),
    };
    const useCase = new ListBatteryUsers(repository as any);

    const result = await useCase.execute('battery-1');

    expect(repository.listUsers).toHaveBeenCalledWith('battery-1');
    expect(result).toEqual(users);
  });
});
