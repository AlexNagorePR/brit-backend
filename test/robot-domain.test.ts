import { describe, it, expect } from 'vitest';
import { Robot } from '@/domain/models/robot.js';

describe('Robot', () => {
  it('should create a new robot with valid data', () => {
    const robot = Robot.create('robot-1', 'robot.local', 'Robot A', 'client-1', ['user@example.com']);

    expect(robot.getId()).toBe('robot-1');
    expect(robot.getClientId()).toBe('client-1');
    expect(robot.getHostName()).toBe('robot.local');
    expect(robot.getRobotName()).toBe('Robot A');
    expect(robot.getUserEmails()).toEqual(['user@example.com']);
  });

  it('should trim host name and robot name', () => {
    const robot = Robot.create('robot-1', '  robot.local  ', '  Robot A  ');

    expect(robot.getHostName()).toBe('robot.local');
    expect(robot.getRobotName()).toBe('Robot A');
  });

  it('should throw error if host name is empty', () => {
    expect(() => Robot.create('robot-1', '', 'Robot A')).toThrow('Host name is required');
  });

  it('should throw error if robot name is empty', () => {
    expect(() => Robot.create('robot-1', 'robot.local', '')).toThrow('Robot name is required');
  });

  it('should update robot name', () => {
    const robot = Robot.create('robot-1', 'robot.local', 'Robot A');
    robot.updateRobotName('Robot B');

    expect(robot.getRobotName()).toBe('Robot B');
  });

  it('should add user email', () => {
    const robot = Robot.create('robot-1', 'robot.local', 'Robot A');
    robot.addUserEmail('user@example.com');

    expect(robot.getUserEmails()).toContain('user@example.com');
  });

  it('should not add duplicate emails', () => {
    const robot = Robot.create('robot-1', 'robot.local', 'Robot A', undefined, ['user@example.com']);
    robot.addUserEmail('user@example.com');

    expect(robot.getUserEmails().length).toBe(1);
  });

  it('should normalize initial user emails', () => {
    const robot = Robot.create('robot-1', 'robot.local', 'Robot A', undefined, [' User@EXAMPLE.COM ', 'user@example.com']);

    expect(robot.getUserEmails()).toEqual(['user@example.com']);
  });

  it('should remove user email', () => {
    const robot = Robot.create('robot-1', 'robot.local', 'Robot A', undefined, ['user1@example.com', 'user2@example.com']);
    robot.removeUserEmail('user1@example.com');

    expect(robot.getUserEmails()).toEqual(['user2@example.com']);
  });

  it('should lowercase emails', () => {
    const robot = Robot.create('robot-1', 'robot.local', 'Robot A');
    robot.addUserEmail('User@EXAMPLE.COM');

    expect(robot.getUserEmails()).toContain('user@example.com');
  });

  it('should serialize to JSON', () => {
    const robot = Robot.create('robot-1', 'robot.local', 'Robot A', 'client-1', ['user@example.com']);
    const json = robot.toJSON();

    expect(json).toHaveProperty('id', 'robot-1');
    expect(json).toHaveProperty('clientId', 'client-1');
    expect(json).toHaveProperty('hostName', 'robot.local');
    expect(json).toHaveProperty('robotName', 'Robot A');
    expect(json).toHaveProperty('userEmails', ['user@example.com']);
  });

  it('should reconstruct from database', () => {
    const createdAt = new Date('2026-05-01');
    const robot = Robot.reconstruct(
      'robot-1',
      'robot.local',
      'Robot A',
      'client-1',
      '2026-01-15',
      '2026-04-01',
      '2026-05-10',
      undefined,
      undefined,
      undefined,
      undefined,
      ['user@example.com'],
      createdAt
    );

    expect(robot.getId()).toBe('robot-1');
    expect(robot.getHostName()).toBe('robot.local');
    expect(robot.getCreatedAt()).toEqual(createdAt);
    expect(robot.getDeliveryDate()).toBe('2026-01-15');
    expect(robot.getLastMaintenanceDate()).toBe('2026-04-01');
    expect(robot.getLastCleanDate()).toBe('2026-05-10');
  });

  it('should store and retrieve delivery dates', () => {
    const robot = Robot.create(
      'robot-1',
      'robot.local',
      'Robot A',
      'client-1',
      [],
      '2026-01-15',
      '2026-04-01',
      '2026-05-10',
      '2026-05-13'
    );

    expect(robot.getDeliveryDate()).toBe('2026-01-15');
    expect(robot.getLastMaintenanceDate()).toBe('2026-04-01');
    expect(robot.getLastCleanDate()).toBe('2026-05-10');
    expect(robot.getLastWorkDate()).toBe('2026-05-13');
  });

  it('should store and retrieve work metrics', () => {
    const robot = Robot.create(
      'robot-1',
      'robot.local',
      'Robot A',
      'client-1',
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      12,
      1234.5,
      678.25
    );

    expect(robot.getWorksPerformed()).toBe(12);
    expect(robot.getTimeInOperation()).toBe(1234.5);
    expect(robot.getTimeWorking()).toBe(678.25);
  });

  it('should include all properties in JSON serialization', () => {
    const robot = Robot.create(
      'robot-1',
      'robot.local',
      'Robot A',
      'client-1',
      ['user@example.com'],
      '2026-01-15',
      '2026-04-01',
      '2026-05-10',
      '2026-05-13',
      12,
      1234.5,
      678.25
    );

    const json = robot.toJSON();

    expect(json).toHaveProperty('id', 'robot-1');
    expect(json).toHaveProperty('hostName', 'robot.local');
    expect(json).toHaveProperty('deliveryDate', '2026-01-15');
    expect(json).toHaveProperty('lastMaintenanceDate', '2026-04-01');
    expect(json).toHaveProperty('lastCleanDate', '2026-05-10');
    expect(json).toHaveProperty('lastWorkDate', '2026-05-13');
    expect(json).toHaveProperty('worksPerformed', 12);
    expect(json).toHaveProperty('timeInOperation', 1234.5);
    expect(json).toHaveProperty('timeWorking', 678.25);
  });
});
