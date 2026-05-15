import { describe, it, expect, vi } from 'vitest';
import { User } from '@/domain/models/user.js';
import { CreateUser } from '@/application/use-cases/users/create-user.js';
import { DeleteUser } from '@/application/use-cases/users/delete-user.js';
import { UserNotFoundError, UserValidationError } from '@/application/use-cases/users/errors.js';
import { FindUserById } from '@/application/use-cases/users/find-user-by-id.js';
import { ListUsers } from '@/application/use-cases/users/list-users.js';
import { ListUsersByClient } from '@/application/use-cases/users/list-users-by-client.js';
import { SyncIdentityUsers } from '@/application/use-cases/users/sync-identity-users.js';
import { UpdateUserClient } from '@/application/use-cases/users/update-user-client.js';

function createRepository(overrides = {}) {
  return {
    create: vi.fn(),
    list: vi.fn(),
    listByClient: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    updateClient: vi.fn(),
    delete: vi.fn(),
    syncIdentityUsers: vi.fn(),
    ...overrides,
  };
}

describe('User use cases', () => {
  it('creates a user through the repository', async () => {
    const repository = createRepository({
      create: vi.fn().mockResolvedValue('user-1'),
    });
    const useCase = new CreateUser(repository as any);

    const result = await useCase.execute({
      id: 'user-1',
      email: '  ONE@EXAMPLE.COM  ',
      clientId: 'client-1',
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'one@example.com',
      clientId: 'client-1',
    });
    expect(repository.create).toHaveBeenCalledWith(expect.any(User));
    expect((repository.create as any).mock.calls[0][0].getEmail()).toBe('one@example.com');
  });

  it('throws if user email is invalid', async () => {
    const repository = createRepository();
    const useCase = new CreateUser(repository as any);

    await expect(useCase.execute({
      id: 'user-1',
      email: 'not-an-email',
    })).rejects.toThrow(UserValidationError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lists users', async () => {
    const repository = createRepository({
      list: vi.fn().mockResolvedValue([
        User.reconstruct('user-1', 'one@example.com', 'client-1'),
        User.reconstruct('user-2', 'two@example.com'),
      ]),
    });
    const useCase = new ListUsers(repository as any);

    await expect(useCase.execute()).resolves.toEqual([
      { id: 'user-1', email: 'one@example.com', clientId: 'client-1' },
      { id: 'user-2', email: 'two@example.com', clientId: null },
    ]);
  });

  it('lists users by client', async () => {
    const repository = createRepository({
      listByClient: vi.fn().mockResolvedValue([
        User.reconstruct('user-1', 'one@example.com', 'client-1'),
      ]),
    });
    const useCase = new ListUsersByClient(repository as any);

    await expect(useCase.execute('client-1')).resolves.toEqual([
      { id: 'user-1', email: 'one@example.com', clientId: 'client-1' },
    ]);
    expect(repository.listByClient).toHaveBeenCalledWith('client-1');
  });

  it('optionally finds a user by id', async () => {
    const repository = createRepository({
      findById: vi.fn()
        .mockResolvedValueOnce(User.reconstruct('user-1', 'one@example.com'))
        .mockResolvedValueOnce(null),
    });
    const useCase = new FindUserById(repository as any);

    await expect(useCase.execute('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'one@example.com',
      clientId: null,
    });
    await expect(useCase.execute('missing')).resolves.toBeNull();
  });

  it('updates a user client', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(User.reconstruct('user-1', 'one@example.com')),
      updateClient: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new UpdateUserClient(repository as any);

    await expect(useCase.execute({
      userId: 'user-1',
      clientId: 'client-1',
    })).resolves.toEqual({
      id: 'user-1',
      email: 'one@example.com',
      clientId: 'client-1',
    });
    expect(repository.updateClient).toHaveBeenCalledWith('user-1', 'client-1');
  });

  it('clears a user client', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(User.reconstruct('user-1', 'one@example.com', 'client-1')),
      updateClient: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new UpdateUserClient(repository as any);

    await expect(useCase.execute({
      userId: 'user-1',
      clientId: null,
    })).resolves.toEqual({
      id: 'user-1',
      email: 'one@example.com',
      clientId: null,
    });
    expect(repository.updateClient).toHaveBeenCalledWith('user-1', undefined);
  });

  it('does not update a missing user', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(null),
    });
    const useCase = new UpdateUserClient(repository as any);

    await expect(useCase.execute({
      userId: 'missing',
      clientId: 'client-1',
    })).rejects.toThrow(UserNotFoundError);
    expect(repository.updateClient).not.toHaveBeenCalled();
  });

  it('deletes a user', async () => {
    const repository = createRepository({
      delete: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new DeleteUser(repository as any);

    await expect(useCase.execute('user-1')).resolves.toEqual({ id: 'user-1' });
    expect(repository.delete).toHaveBeenCalledWith('user-1');
  });

  it('syncs identity users', async () => {
    const users = [{ username: 'user-1', email: 'one@example.com' }];
    const repository = createRepository({
      syncIdentityUsers: vi.fn().mockResolvedValue(undefined),
    });
    const useCase = new SyncIdentityUsers(repository as any);

    await expect(useCase.execute(users)).resolves.toEqual({
      count: 1,
      users,
    });
    expect(repository.syncIdentityUsers).toHaveBeenCalledWith(users);
  });
});
