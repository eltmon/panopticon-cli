import { describe, it, expect } from 'vitest';
import {
  NotImplementedError,
  IssueNotFoundError,
  TrackerAuthError,
} from '../../../src/lib/tracker/interface.js';

describe('Tracker Errors', () => {
  describe('NotImplementedError', () => {
    it('should create error with feature message', () => {
      const error = new NotImplementedError('GitLab tracker');
      expect(error.message).toBe('Not implemented: GitLab tracker');
      expect(error.name).toBe('NotImplementedError');
    });
  });

  describe('IssueNotFoundError', () => {
    it('should create error with issue id and tracker', () => {
      const error = new IssueNotFoundError('MIN-123', 'linear');
      expect(error.message).toBe('Issue not found: MIN-123 (tracker: linear)');
      expect(error.name).toBe('IssueNotFoundError');
    });
  });

  describe('TrackerAuthError', () => {
    it('should create error with tracker and message', () => {
      const error = new TrackerAuthError('github', 'Token expired');
      expect(error.message).toBe('Authentication failed for github: Token expired');
      expect(error.name).toBe('TrackerAuthError');
    });
  });
});
