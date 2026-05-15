import { Client } from '@/domain/models/client.js';

export interface ClientRepository {
  create(client: Client): Promise<string>;
  list(): Promise<Client[]>;
  findById(clientId: string): Promise<Client | null>;
  findByName(name: string): Promise<Client | null>;
  exists(clientId: string): Promise<boolean>;
  delete(clientId: string): Promise<void>;
}
