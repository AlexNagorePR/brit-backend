import { User } from '@/domain/models/user.js';

export type UserResult = {
  id: string;
  email: string;
  clientId: string | null;
};

export function toUserResult(user: User): UserResult {
  return {
    id: user.getId(),
    email: user.getEmail(),
    clientId: user.getClientId() ?? null,
  };
}
