import type { UserRepository } from '@/application/ports/user-repository.js';

export type DeleteUserResult = {
  id: string;
};

export class DeleteUser {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(id: string): Promise<DeleteUserResult> {
    await this.userRepository.delete(id);
    return { id };
  }
}
