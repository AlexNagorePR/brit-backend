import { describe, it, expect } from 'vitest';
import { Battery } from '../src/domain/models/battery';

describe('Battery', () => {
  it('should create a new battery without database id', () => {
    const battery = Battery.create('client-1', 'SN-001', 95);

    expect(battery.getId()).toBe('');
    expect(battery.getClientId()).toBe('client-1');
    expect(battery.getSerialNumber()).toBe('SN-001');
    expect(battery.getStateOfHealth()).toBe(95);
    expect(battery.getCreatedAt()).toBeInstanceOf(Date);
  });

  it('should create battery without optional state of health', () => {
    const battery = Battery.create('client-1', 'SN-001');

    expect(battery.getClientId()).toBe('client-1');
    expect(battery.getSerialNumber()).toBe('SN-001');
    expect(battery.getStateOfHealth()).toBeUndefined();
  });

  it('should trim client id and serial number', () => {
    const battery = Battery.create('  client-1  ', '  SN-001  ');

    expect(battery.getClientId()).toBe('client-1');
    expect(battery.getSerialNumber()).toBe('SN-001');
  });

  it('should throw error if serial number is empty', () => {
    expect(() => Battery.create('client-1', '')).toThrow('Serial number is required');
  });

  it('should throw error if serial number is only whitespace', () => {
    expect(() => Battery.create('client-1', '   ')).toThrow('Serial number is required');
  });

  it('should throw error if client id is empty', () => {
    expect(() => Battery.create('', 'SN-001')).toThrow('Client id is required');
  });

  it('should throw error if client id is only whitespace', () => {
    expect(() => Battery.create('   ', 'SN-001')).toThrow('Client id is required');
  });

  it('should accept boundary state of health values', () => {
    expect(Battery.create('client-1', 'SN-001', 0).getStateOfHealth()).toBe(0);
    expect(Battery.create('client-1', 'SN-001', 100).getStateOfHealth()).toBe(100);
  });

  it('should throw error if state of health is below range', () => {
    expect(() => Battery.create('client-1', 'SN-001', -1)).toThrow('State of health must be between 0 and 100');
  });

  it('should throw error if state of health is above range', () => {
    expect(() => Battery.create('client-1', 'SN-001', 101)).toThrow('State of health must be between 0 and 100');
  });

  it('should update serial number', () => {
    const battery = Battery.create('client-1', 'SN-001');
    battery.updateSerialNumber('SN-002');

    expect(battery.getSerialNumber()).toBe('SN-002');
  });

  it('should throw error when clearing serial number', () => {
    const battery = Battery.create('client-1', 'SN-001');

    expect(() => battery.updateSerialNumber('')).toThrow('Serial number is required');
  });

  it('should update state of health', () => {
    const battery = Battery.create('client-1', 'SN-001', 80);
    battery.updateStateOfHealth(90);

    expect(battery.getStateOfHealth()).toBe(90);
  });

  it('should clear state of health', () => {
    const battery = Battery.create('client-1', 'SN-001', 80);
    battery.updateStateOfHealth(undefined);

    expect(battery.getStateOfHealth()).toBeUndefined();
  });

  it('should reconstruct from database', () => {
    const createdAt = new Date('2026-01-01');
    const battery = Battery.reconstruct('battery-1', 'client-1', 'SN-001', 95, createdAt);

    expect(battery.getId()).toBe('battery-1');
    expect(battery.getClientId()).toBe('client-1');
    expect(battery.getSerialNumber()).toBe('SN-001');
    expect(battery.getStateOfHealth()).toBe(95);
    expect(battery.getCreatedAt()).toEqual(createdAt);
  });

  it('should serialize to JSON', () => {
    const createdAt = new Date('2026-01-01');
    const battery = Battery.reconstruct('battery-1', 'client-1', 'SN-001', 95, createdAt);
    const json = battery.toJSON();

    expect(json).toHaveProperty('id', 'battery-1');
    expect(json).toHaveProperty('clientId', 'client-1');
    expect(json).toHaveProperty('serialNumber', 'SN-001');
    expect(json).toHaveProperty('stateOfHealth', 95);
    expect(json.createdAt).toContain('2026-01-01');
  });
});
