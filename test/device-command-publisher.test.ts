import { describe, it, expect } from 'vitest';
import * as commandPublisher from '@/server/device-command-publisher.js';

describe('device-command-publisher', () => {
  describe('validateCommandMessage', () => {
    it('should reject ink_level with invalid value', () => {
      expect(() => {
        commandPublisher.validateCommandMessage('/ink_level', { data: 5 });
      }).toThrow('Invalid ink_level');
    });

    it('should accept ink_level with valid values', () => {
      const validValues = [0, 1, 2];
      
      validValues.forEach(value => {
        expect(() => {
          commandPublisher.validateCommandMessage('/ink_level', { data: value });
        }).not.toThrow();
      });
    });

    it('should reject ink_level that is not a number', () => {
      expect(() => {
        commandPublisher.validateCommandMessage('/ink_level', { data: 'not a number' });
      }).toThrow('Invalid ink_level');
    });

    it('should warn for unknown topics', () => {
      // Should not throw, just warn
      expect(() => {
        commandPublisher.validateCommandMessage('/unknown_topic', { data: 123 });
      }).not.toThrow();
    });
  });
});
