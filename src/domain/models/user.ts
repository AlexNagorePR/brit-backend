// src/domain/models/user.ts

/**
 * User domain model
 */
export class User {
  private id: string;
  private email: string;
  private clientId?: string;
  private createdAt: Date;

  constructor(
    id: string,
    email: string,
    clientId?: string,
    createdAt: Date = new Date(),
  ) {
    this.id = id;
    this.email = email;
    this.clientId = clientId;
    this.createdAt = new Date(createdAt);
  }

  static create(
    id: string,
    email: string,
    clientId?: string
  ): User {
    if (!email || !email.trim()) {
      throw new Error('Email is required');
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!this.isValidEmail(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    return new User(
      id,
      trimmedEmail,
      clientId
    );
  }

  static reconstruct(
    id: string,
    email: string,
    clientId?: string,
    createdAt?: Date
  ): User {
    return new User(
      id,
      email,
      clientId,
      createdAt
    );
  }

  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getId(): string {
    return this.id;
  }

  getClientId(): string | undefined {
    return this.clientId;
  }

  getEmail(): string {
    return this.email;
  }

  getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  updateEmail(newEmail: string): void {
    if (!newEmail || !newEmail.trim()) {
      throw new Error('Email is required');
    }

    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!User.isValidEmail(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    this.email = trimmedEmail;
  }

  updateClient(clientId?: string): void {
    this.clientId = clientId;
  }

  toJSON() {
    return {
      id: this.id,
      clientId: this.clientId,
      email: this.email,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
