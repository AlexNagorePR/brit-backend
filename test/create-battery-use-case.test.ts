import { describe, it, expect, vi } from 'vitest';
import { Battery } from '@/domain/models/battery.js';
import {
  ClientNotFoundError,
  CreateBattery,
  CreateBatteryValidationError,
} from '@/application/use-cases/batteries/create-battery.js';

describe('CreateBattery use case', () => {
  it('creates a battery through the repository', async () => {
    const batteryRepository = {
      create: vi.fn().mockResolvedValue('battery-1'),
    };
    const clientRepository = {
      exists: vi.fn().mockResolvedValue(true),
    };
    const useCase = new CreateBattery({
      batteryRepository: batteryRepository as any,
      clientRepository: clientRepository as any,
    });

    const result = await useCase.execute({
      clientId: '  client-1  ',
      serialNumber: '  SN-001  ',
      stateOfHealth: 0,
    });

    expect(result).toEqual({
      id: 'battery-1',
      clientId: 'client-1',
      serialNumber: 'SN-001',
      stateOfHealth: 0,
    });
    expect(clientRepository.exists).toHaveBeenCalledWith('client-1');
    expect(batteryRepository.create).toHaveBeenCalledWith(expect.any(Battery));
  });

  it('throws if serial number is missing', async () => {
    const useCase = new CreateBattery({
      batteryRepository: { create: vi.fn() } as any,
      clientRepository: { exists: vi.fn() } as any,
    });

    await expect(useCase.execute({
      clientId: 'client-1',
      serialNumber: '',
    })).rejects.toThrow(CreateBatteryValidationError);
  });

  it('throws if client does not exist', async () => {
    const batteryRepository = {
      create: vi.fn(),
    };
    const useCase = new CreateBattery({
      batteryRepository: batteryRepository as any,
      clientRepository: { exists: vi.fn().mockResolvedValue(false) } as any,
    });

    await expect(useCase.execute({
      clientId: 'client-1',
      serialNumber: 'SN-001',
    })).rejects.toThrow(ClientNotFoundError);
    expect(batteryRepository.create).not.toHaveBeenCalled();
  });
});
