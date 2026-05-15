import { describe, it, expect } from 'vitest';
import { Client } from '../src/domain/models/client';

describe('Client', () => {
  it('should create a new client without database id', () => {
    const client = Client.create('Acme Corp');

    expect(client.getId()).toBe('');
    expect(client.getName()).toBe('Acme Corp');
    expect(client.getCreatedAt()).toBeInstanceOf(Date);
  });

  it('should trim client name', () => {
    const client = Client.create('  Acme Corp  ');

    expect(client.getName()).toBe('Acme Corp');
  });

  it('should throw error if name is empty', () => {
    expect(() => Client.create('')).toThrow('Client name is required');
  });

  it('should throw error if name is only whitespace', () => {
    expect(() => Client.create('   ')).toThrow('Client name is required');
  });

  it('should update client name', () => {
    const client = Client.create('Acme Corp');
    client.updateName('Acme Industries');

    expect(client.getName()).toBe('Acme Industries');
  });

  it('should throw error when updating to empty name', () => {
    const client = Client.create('Acme Corp');
    expect(() => client.updateName('')).toThrow('Client name is required');
  });

  it('should serialize to JSON', () => {
    const client = Client.create('Acme Corp');
    const json = client.toJSON();

    expect(json).toHaveProperty('id', '');
    expect(json).toHaveProperty('name', 'Acme Corp');
    expect(json).toHaveProperty('createdAt');
  });

  it('should reconstruct from database', () => {
    const createdAt = new Date('2026-01-01');
    const client = Client.reconstruct('client-1', 'Acme Corp', createdAt);

    expect(client.getId()).toBe('client-1');
    expect(client.getName()).toBe('Acme Corp');
    expect(client.getCreatedAt()).toEqual(createdAt);
  });

  it('should include all properties in JSON serialization', () => {
    const createdAt = new Date('2026-01-01');
    const client = Client.reconstruct('client-1', 'Acme Corp', createdAt);
    const json = client.toJSON();

    expect(json).toHaveProperty('id', 'client-1');
    expect(json).toHaveProperty('name', 'Acme Corp');
    expect(json.createdAt).toContain('2026-01-01');
  });
});
