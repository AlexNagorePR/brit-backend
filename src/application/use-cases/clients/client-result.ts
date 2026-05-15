import { Client } from '@/domain/models/client.js';

export type ClientResult = {
  id: string;
  name: string;
};

export function toClientResult(client: Client): ClientResult {
  return {
    id: client.getId(),
    name: client.getName(),
  };
}
