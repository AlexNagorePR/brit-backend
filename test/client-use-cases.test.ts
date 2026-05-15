import { describe, it, expect, vi } from 'vitest';
import { Client } from '@/domain/models/client.js';
import { CreateClient } from '@/application/use-cases/clients/create-client.js';
import { DeleteClient } from '@/application/use-cases/clients/delete-client.js';
import { ClientNotFoundError, ClientValidationError } from '@/application/use-cases/clients/errors.js';
import { FindClientById } from '@/application/use-cases/clients/find-client-by-id.js';
import { FindClientByName } from '@/application/use-cases/clients/find-client-by-name.js';
import { GetClient } from '@/application/use-cases/clients/get-client.js';
import { ListClients } from '@/application/use-cases/clients/list-clients.js';

function createRepository(overrides = {}) {
  return {
    create: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  };
}

describe('Client use cases', () => {
  it('creates a client through the repository', async () => {
    const repository = createRepository({
      create: vi.fn().mockResolvedValue('client-1'),
    });
    const useCase = new CreateClient(repository as any);

    const result = await useCase.execute({ name: '  Acme Corp  ' });

    expect(result).toEqual({
      id: 'client-1',
      name: 'Acme Corp',
    });
    expect(repository.create).toHaveBeenCalledWith(expect.any(Client));
    expect((repository.create as any).mock.calls[0][0].getName()).toBe('Acme Corp');
  });

  it('throws if client name is missing', async () => {
    const repository = createRepository();
    const useCase = new CreateClient(repository as any);

    await expect(useCase.execute({ name: '   ' }))
      .rejects.toThrow(ClientValidationError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lists clients', async () => {
    const repository = createRepository({
      list: vi.fn().mockResolvedValue([
        Client.reconstruct('client-1', 'Acme Corp'),
        Client.reconstruct('client-2', 'Globex'),
      ]),
    });
    const useCase = new ListClients(repository as any);

    await expect(useCase.execute()).resolves.toEqual([
      { id: 'client-1', name: 'Acme Corp' },
      { id: 'client-2', name: 'Globex' },
    ]);
  });

  it('gets a client by id', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(Client.reconstruct('client-1', 'Acme Corp')),
    });
    const useCase = new GetClient(repository as any);

    await expect(useCase.execute('client-1')).resolves.toEqual({
      id: 'client-1',
      name: 'Acme Corp',
    });
    expect(repository.findById).toHaveBeenCalledWith('client-1');
  });

  it('optionally finds a client by id', async () => {
    const repository = createRepository({
      findById: vi.fn()
        .mockResolvedValueOnce(Client.reconstruct('client-1', 'Acme Corp'))
        .mockResolvedValueOnce(null),
    });
    const useCase = new FindClientById(repository as any);

    await expect(useCase.execute('client-1')).resolves.toEqual({
      id: 'client-1',
      name: 'Acme Corp',
    });
    await expect(useCase.execute('client-missing')).resolves.toBeNull();
  });

  it('throws if a client is not found', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(null),
    });
    const useCase = new GetClient(repository as any);

    await expect(useCase.execute('client-missing'))
      .rejects.toThrow(ClientNotFoundError);
  });

  it('finds a client by name', async () => {
    const repository = createRepository({
      findByName: vi.fn().mockResolvedValue(Client.reconstruct('client-1', 'Acme Corp')),
    });
    const useCase = new FindClientByName(repository as any);

    await expect(useCase.execute('Acme Corp')).resolves.toEqual({
      id: 'client-1',
      name: 'Acme Corp',
    });
    expect(repository.findByName).toHaveBeenCalledWith('Acme Corp');
  });

  it('deletes an existing client', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(Client.reconstruct('client-1', 'Acme Corp')),
      delete: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new DeleteClient(repository as any);

    await expect(useCase.execute('client-1')).resolves.toEqual({ id: 'client-1' });
    expect(repository.findById).toHaveBeenCalledWith('client-1');
    expect(repository.delete).toHaveBeenCalledWith('client-1');
  });

  it('does not delete a missing client', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(null),
    });
    const useCase = new DeleteClient(repository as any);

    await expect(useCase.execute('client-missing'))
      .rejects.toThrow(ClientNotFoundError);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
