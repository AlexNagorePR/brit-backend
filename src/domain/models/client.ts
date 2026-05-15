// src/domain/models/client.ts

export class Client {
  private id: string;
  private name: string;
  private createdAt: Date;

  constructor(
    id: string,
    name: string,
    createdAt: Date = new Date(),
  ) {
    this.id = id;
    this.name = name;
    this.createdAt = new Date(createdAt);
  }

  static create(
    name: string
  ): Client {
    if (!name || !name.trim()) {
      throw new Error('Client name is required');
    }

    const placeholderId = '';

    return new Client(
      placeholderId,
      name.trim()
    );
  }

  static reconstruct(
    id: string,
    name: string,
    createdAt?: Date
  ): Client {
    return new Client(
      id,
      name,
      createdAt
    );
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  updateName(newName: string): void {
    if (!newName || !newName.trim()) {
      throw new Error('Client name is required');
    }
    this.name = newName.trim();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
