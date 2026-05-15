import { Client } from '@/domain/models/client.js';
import type { ClientRepository } from '@/application/ports/client-repository.js';
import type { Db } from '@/server/db.js';

type ClientDb = Pick<
  Db,
  | 'createClient'
  | 'getAllClients'
  | 'getClient'
  | 'getClientByName'
  | 'deleteClient'
>;

function toDomainClient(client: {
  id: string;
  name: string;
}): Client {
  return Client.reconstruct(client.id, client.name);
}

export function createDbClientRepository(db: ClientDb): ClientRepository {
  return {
    create(client: Client): Promise<string> {
      return db.createClient(client.getName());
    },

    async list(): Promise<Client[]> {
      const clients = await db.getAllClients();
      return clients.map(toDomainClient);
    },

    async findById(clientId: string): Promise<Client | null> {
      const client = await db.getClient(clientId);
      return client ? toDomainClient(client) : null;
    },

    async findByName(name: string): Promise<Client | null> {
      const client = await db.getClientByName(name);
      return client ? toDomainClient(client) : null;
    },

    async exists(clientId: string): Promise<boolean> {
      const client = await db.getClient(clientId);
      return Boolean(client);
    },

    delete(clientId: string): Promise<void> {
      return db.deleteClient(clientId);
    },
  };
}
