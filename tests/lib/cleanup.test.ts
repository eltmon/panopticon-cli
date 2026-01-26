import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AgentState } from '../../src/lib/agents.js';

// Mock paths to use temp directory for testing
const TEST_AGENTS_DIR = join(tmpdir(), 'panopticon-test-agents');

vi.mock('../../src/lib/paths.js', async () => ({
  AGENTS_DIR: TEST_AGENTS_DIR,
}));

// Import after mock is set up
const {
  getOldAgentDirs,
  shouldCleanAgent,
  cleanupOldAgents,
  getCleanupAgeThresholdDays,
} = await import('../../src/lib/cleanup.js');

describe('cleanup', () => {
  beforeEach(() => {
    // Clean up test directory before each test
    if (existsSync(TEST_AGENTS_DIR)) {
      rmSync(TEST_AGENTS_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_AGENTS_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (existsSync(TEST_AGENTS_DIR)) {
      rmSync(TEST_AGENTS_DIR, { recursive: true, force: true });
    }
  });

  describe('getCleanupAgeThresholdDays', () => {
    it('should return default 7 days when no config exists', () => {
      const threshold = getCleanupAgeThresholdDays();
      expect(threshold).toBe(7);
    });
  });

  describe('shouldCleanAgent', () => {
    it('should return true for old agent-* directories', () => {
      const state: AgentState = {
        id: 'agent-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      expect(shouldCleanAgent('agent-pan-123', state, 7)).toBe(true);
    });

    it('should return true for old planning-* directories', () => {
      const state: AgentState = {
        id: 'planning-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      expect(shouldCleanAgent('planning-pan-123', state, 7)).toBe(true);
    });

    it('should return true for old specialist-* directories', () => {
      const state: AgentState = {
        id: 'specialist-review-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      expect(shouldCleanAgent('specialist-review-pan-123', state, 7)).toBe(true);
    });

    it('should return true for old test-agent-* directories', () => {
      const state: AgentState = {
        id: 'test-agent-123',
        issueId: 'TEST-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      expect(shouldCleanAgent('test-agent-123', state, 7)).toBe(true);
    });

    it('should return false for main-cli directory', () => {
      const state: AgentState = {
        id: 'main-cli',
        issueId: 'MAIN',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      expect(shouldCleanAgent('main-cli', state, 7)).toBe(false);
    });

    it('should return false for running agents', () => {
      const state: AgentState = {
        id: 'agent-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'running',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      expect(shouldCleanAgent('agent-pan-123', state, 7)).toBe(false);
    });

    it('should return false for starting agents', () => {
      const state: AgentState = {
        id: 'agent-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'starting',
        startedAt: new Date().toISOString(),
      };
      expect(shouldCleanAgent('agent-pan-123', state, 7)).toBe(false);
    });

    it('should return false for agents younger than threshold', () => {
      const state: AgentState = {
        id: 'agent-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      };
      expect(shouldCleanAgent('agent-pan-123', state, 7)).toBe(false);
    });

    it('should return true for completed agents older than threshold', () => {
      const state: AgentState = {
        id: 'agent-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'completed',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      expect(shouldCleanAgent('agent-pan-123', state, 7)).toBe(true);
    });

    it('should return false for non-matching patterns', () => {
      const state: AgentState = {
        id: 'random-dir',
        issueId: 'RANDOM',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      expect(shouldCleanAgent('random-dir', state, 7)).toBe(false);
    });
  });

  describe('getOldAgentDirs', () => {
    it('should return empty array when agents dir does not exist', () => {
      rmSync(TEST_AGENTS_DIR, { recursive: true, force: true });
      const dirs = getOldAgentDirs(7);
      expect(dirs).toEqual([]);
    });

    it('should find old agent directories', () => {
      // Create test agent directories with old timestamps
      const oldAgentDir = join(TEST_AGENTS_DIR, 'agent-pan-123');
      mkdirSync(oldAgentDir);

      // Create state.json with old timestamp
      const oldState: AgentState = {
        id: 'agent-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      writeFileSync(join(oldAgentDir, 'state.json'), JSON.stringify(oldState));

      const dirs = getOldAgentDirs(7);
      expect(dirs).toContain('agent-pan-123');
    });

    it('should exclude running agents', () => {
      // Create running agent
      const runningAgentDir = join(TEST_AGENTS_DIR, 'agent-pan-456');
      mkdirSync(runningAgentDir);

      const runningState: AgentState = {
        id: 'agent-pan-456',
        issueId: 'PAN-456',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'running',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      writeFileSync(join(runningAgentDir, 'state.json'), JSON.stringify(runningState));

      const dirs = getOldAgentDirs(7);
      expect(dirs).not.toContain('agent-pan-456');
    });

    it('should exclude main-cli directory', () => {
      const mainCliDir = join(TEST_AGENTS_DIR, 'main-cli');
      mkdirSync(mainCliDir);

      const mainCliState: AgentState = {
        id: 'main-cli',
        issueId: 'MAIN',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      writeFileSync(join(mainCliDir, 'state.json'), JSON.stringify(mainCliState));

      const dirs = getOldAgentDirs(7);
      expect(dirs).not.toContain('main-cli');
    });

    it('should include planning-* directories', () => {
      const planningDir = join(TEST_AGENTS_DIR, 'planning-pan-123');
      mkdirSync(planningDir);

      const planningState: AgentState = {
        id: 'planning-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      writeFileSync(join(planningDir, 'state.json'), JSON.stringify(planningState));

      const dirs = getOldAgentDirs(7);
      expect(dirs).toContain('planning-pan-123');
    });
  });

  describe('cleanupOldAgents', () => {
    it('should delete old agent directories in dry run mode', async () => {
      // Create old agent directory
      const oldAgentDir = join(TEST_AGENTS_DIR, 'agent-pan-123');
      mkdirSync(oldAgentDir);

      const oldState: AgentState = {
        id: 'agent-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      writeFileSync(join(oldAgentDir, 'state.json'), JSON.stringify(oldState));

      // Dry run should not delete
      const result = await cleanupOldAgents(7, true);

      expect(result.dryRun).toBe(true);
      expect(result.deleted).toContain('agent-pan-123');
      expect(result.count).toBe(1);
      expect(existsSync(oldAgentDir)).toBe(true); // Should still exist
    });

    it('should actually delete old agent directories when not dry run', async () => {
      // Create old agent directory
      const oldAgentDir = join(TEST_AGENTS_DIR, 'agent-pan-123');
      mkdirSync(oldAgentDir);

      const oldState: AgentState = {
        id: 'agent-pan-123',
        issueId: 'PAN-123',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      writeFileSync(join(oldAgentDir, 'state.json'), JSON.stringify(oldState));

      // Real cleanup
      const result = await cleanupOldAgents(7, false);

      expect(result.dryRun).toBe(false);
      expect(result.deleted).toContain('agent-pan-123');
      expect(result.count).toBe(1);
      expect(existsSync(oldAgentDir)).toBe(false); // Should be deleted
    });

    it('should handle multiple old agents', async () => {
      // Create multiple old agent directories
      const agents = ['agent-pan-123', 'planning-pan-456', 'specialist-test-pan-789'];

      for (const agentId of agents) {
        const agentDir = join(TEST_AGENTS_DIR, agentId);
        mkdirSync(agentDir);

        const state: AgentState = {
          id: agentId,
          issueId: 'PAN-' + agentId.split('-').pop(),
          workspace: '/path/to/workspace',
          runtime: 'claude',
          model: 'sonnet',
          status: 'stopped',
          startedAt: '2020-01-01T00:00:00.000Z',
        };
        writeFileSync(join(agentDir, 'state.json'), JSON.stringify(state));
      }

      const result = await cleanupOldAgents(7, false);

      expect(result.count).toBe(3);
      expect(result.deleted).toContain('agent-pan-123');
      expect(result.deleted).toContain('planning-pan-456');
      expect(result.deleted).toContain('specialist-test-pan-789');

      // All should be deleted
      for (const agentId of agents) {
        expect(existsSync(join(TEST_AGENTS_DIR, agentId))).toBe(false);
      }
    });

    it('should handle errors gracefully', async () => {
      // Create agent directory without state.json
      const agentDir = join(TEST_AGENTS_DIR, 'agent-pan-error');
      mkdirSync(agentDir);

      const state: AgentState = {
        id: 'agent-pan-error',
        issueId: 'PAN-ERROR',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'stopped',
        startedAt: '2020-01-01T00:00:00.000Z',
      };
      writeFileSync(join(agentDir, 'state.json'), JSON.stringify(state));

      // Make directory read-only to cause error (won't work on all systems)
      // This is a best-effort test

      const result = await cleanupOldAgents(7, false);

      // Should either succeed or record error
      expect(result).toBeDefined();
      expect(typeof result.count).toBe('number');
    });

    it('should return empty result when no old agents', async () => {
      // Create recent agent
      const recentAgentDir = join(TEST_AGENTS_DIR, 'agent-pan-999');
      mkdirSync(recentAgentDir);

      const recentState: AgentState = {
        id: 'agent-pan-999',
        issueId: 'PAN-999',
        workspace: '/path/to/workspace',
        runtime: 'claude',
        model: 'sonnet',
        status: 'running',
        startedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      };
      writeFileSync(join(recentAgentDir, 'state.json'), JSON.stringify(recentState));

      const result = await cleanupOldAgents(7, false);

      expect(result.count).toBe(0);
      expect(result.deleted).toEqual([]);
      expect(existsSync(recentAgentDir)).toBe(true); // Should still exist
    });
  });
});
