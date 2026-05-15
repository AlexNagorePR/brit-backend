import { describe, it, expect } from 'vitest';
import { User } from '../src/domain/models/user';

describe('User', () => {
  it('should create a new user with valid data', () => {
    const user = User.create('user-1', 'john@example.com', 'client-1');

    expect(user.getId()).toBe('user-1');
    expect(user.getEmail()).toBe('john@example.com');
    expect(user.getClientId()).toBe('client-1');
    expect(user.getCreatedAt()).toBeInstanceOf(Date);
  });

  it('should create user without client id', () => {
    const user = User.create('user-1', 'john@example.com');

    expect(user.getId()).toBe('user-1');
    expect(user.getEmail()).toBe('john@example.com');
    expect(user.getClientId()).toBeUndefined();
  });

  it('should lowercase email', () => {
    const user = User.create('user-1', 'JOHN@EXAMPLE.COM', 'client-1');

    expect(user.getEmail()).toBe('john@example.com');
  });

  it('should trim email', () => {
    const user = User.create('user-1', '  john@example.com  ', 'client-1');

    expect(user.getEmail()).toBe('john@example.com');
  });

  it('should throw error if email is empty', () => {
    expect(() => User.create('user-1', '')).toThrow('Email is required');
  });

  it('should throw error if email is invalid', () => {
    expect(() => User.create('user-1', 'invalid-email', 'client-1')).toThrow('Invalid email format');
  });

  it('should throw error if email has no domain', () => {
    expect(() => User.create('user-1', 'john@', 'client-1')).toThrow('Invalid email format');
  });

  it('should update user email', () => {
    const user = User.create('user-1', 'john@example.com', 'client-1');
    user.updateEmail('jane@example.com');

    expect(user.getEmail()).toBe('jane@example.com');
  });

  it('should throw error when updating to invalid email', () => {
    const user = User.create('user-1', 'john@example.com', 'client-1');
    expect(() => user.updateEmail('invalid-email')).toThrow('Invalid email format');
  });

  it('should update client id', () => {
    const user = User.create('user-1', 'john@example.com', 'client-1');
    user.updateClient('client-2');

    expect(user.getClientId()).toBe('client-2');
  });

  it('should clear client id', () => {
    const user = User.create('user-1', 'john@example.com', 'client-1');
    user.updateClient(undefined);

    expect(user.getClientId()).toBeUndefined();
  });

  it('should serialize to JSON', () => {
    const user = User.create('user-1', 'john@example.com', 'client-1');
    const json = user.toJSON();

    expect(json).toHaveProperty('id', 'user-1');
    expect(json).toHaveProperty('email', 'john@example.com');
    expect(json).toHaveProperty('clientId', 'client-1');
    expect(json).toHaveProperty('createdAt');
  });

  it('should reconstruct from database', () => {
    const createdAt = new Date('2026-01-01');
    const user = User.reconstruct('user-1', 'john@example.com', 'client-1', createdAt);

    expect(user.getId()).toBe('user-1');
    expect(user.getEmail()).toBe('john@example.com');
    expect(user.getClientId()).toBe('client-1');
    expect(user.getCreatedAt()).toEqual(createdAt);
  });

  it('should reconstruct user without client id', () => {
    const createdAt = new Date('2026-01-01');
    const user = User.reconstruct('user-1', 'john@example.com', undefined, createdAt);

    expect(user.getId()).toBe('user-1');
    expect(user.getEmail()).toBe('john@example.com');
    expect(user.getClientId()).toBeUndefined();
    expect(user.getCreatedAt()).toEqual(createdAt);
  });

  it('should include all properties in JSON serialization', () => {
    const createdAt = new Date('2026-01-01');
    const user = User.reconstruct('user-1', 'john@example.com', 'client-1', createdAt);
    const json = user.toJSON();

    expect(json).toHaveProperty('id', 'user-1');
    expect(json).toHaveProperty('email', 'john@example.com');
    expect(json).toHaveProperty('clientId', 'client-1');
    expect(json.createdAt).toContain('2026-01-01');
  });
});
