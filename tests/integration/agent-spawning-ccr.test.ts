/**
 * Integration tests for agent spawning with CCR (claude-code-router)
 *
 * Tests the routing logic between `claude` CLI and `ccr` CLI:
 * 1. Anthropic models always use `claude` CLI
 * 2. Non-Anthropic models use `ccr` CLI if installed
 * 3. Non-Anthropic models fall back to Anthropic models if ccr missing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnAgent, type SpawnOptions, getAgentDir } from '../../src/lib/agents.js';
import type { NormalizedConfig } from '../../src/lib/config-yaml.js';

// Mock child_process for CCR detection
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

// Mock tmux module to avoid actual session creation
vi.mock('../../src/lib/tmux.js', () => ({
  createSession: vi.fn().mockResolvedValue(undefined),
  killSession: vi.fn().mockResolvedValue(undefined),
  sendKeys: vi.fn().mockResolvedValue(undefined),
  sessionExists: vi.fn().mockReturnValue(false),
  getAgentSessions: vi.fn().mockResolvedValue([]),
}));

// Mock hooks module
vi.mock('../../src/lib/hooks.js', () => ({
  initHook: vi.fn(),
  checkHook: vi.fn().mockReturnValue({ allowed: true, hasWork: false }),
  generateFixedPointPrompt: vi.fn().mockReturnValue(''),
  checkAndSetupHooks: vi.fn(),
  writeTaskCache: vi.fn(),
}));

// Mock CV module
vi.mock('../../src/lib/cv.js', () => ({
  startWork: vi.fn(),
  completeWork: vi.fn(),
  getAgentCV: vi.fn().mockReturnValue(null),
}));

// Mock config loading
vi.mock('../../src/lib/config-yaml.js', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    loadConfig: vi.fn().mockReturnValue({
      preset: 'balanced',
      enabledProviders: new Set(['anthropic', 'openai', 'google', 'zai']),
      apiKeys: {
        openai: 'test-key',
        google: 'test-key',
        zai: 'test-key',
      },
      overrides: {},
      geminiThinkingLevel: 3,
    } as NormalizedConfig),
  };
});

describe('agent spawning with CCR routing', () => {
  let testPanopticonHome: string;
  let testAgentsDir: string;
  let mockExec: any;
  let consoleWarnSpy: any;
  const originalPanopticonHome = process.env.PANOPTICON_HOME;

  beforeEach(async () => {
    // Clear all mocks and reset modules FIRST to clear caches
    vi.clearAllMocks();
    vi.resetModules(); // Reset ccr module cache to clear isCcrInstalled cache

    // Create unique temp directory for panopticon home
    testPanopticonHome = join(tmpdir(), `pan-ccr-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    testAgentsDir = join(testPanopticonHome, 'agents');
    mkdirSync(testAgentsDir, { recursive: true });

    // Override PANOPTICON_HOME for tests
    process.env.PANOPTICON_HOME = testPanopticonHome;

    // Get mock for child_process.exec (after resetModules)
    const childProcess = await import('child_process');
    mockExec = vi.mocked(childProcess.exec);

    // Spy on console.warn to verify fallback warnings
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.warn
    consoleWarnSpy.mockRestore();

    // Restore original PANOPTICON_HOME
    if (originalPanopticonHome) {
      process.env.PANOPTICON_HOME = originalPanopticonHome;
    } else {
      delete process.env.PANOPTICON_HOME;
    }

    // Clean up temp directory
    if (existsSync(testPanopticonHome)) {
      rmSync(testPanopticonHome, { recursive: true, force: true });
    }
  });

  it('should use claude CLI for Anthropic models', async () => {
    const options: SpawnOptions = {
      issueId: 'PAN-CCR-1',
      workspace: '/tmp/test-workspace',
      model: 'claude-sonnet-4-5',
      prompt: 'Test prompt for Anthropic model',
    };

    const state = await spawnAgent(options);

    expect(state.id).toBe('agent-pan-ccr-1');
    expect(state.model).toBe('claude-sonnet-4-5');

    // Verify launcher script uses 'claude' CLI
    const agentDir = getAgentDir(state.id);
    const launcherPath = join(agentDir, 'launcher.sh');
    expect(existsSync(launcherPath)).toBe(true);

    const launcherContent = readFileSync(launcherPath, 'utf-8');
    expect(launcherContent).toContain('exec claude');
    expect(launcherContent).not.toContain('exec ccr');

    // No warning should be logged for Anthropic models
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should use ccr CLI for non-Anthropic models when ccr is installed', async () => {
    // Mock ccr as installed
    mockExec.mockImplementation((cmd: any, callback: any) => {
      setImmediate(() => callback(null, { stdout: '/usr/local/bin/ccr', stderr: '' }));
      return {} as any;
    });

    const options: SpawnOptions = {
      issueId: 'PAN-CCR-2',
      workspace: '/tmp/test-workspace',
      model: 'gpt-5.2-codex',
      prompt: 'Test prompt for OpenAI model',
    };

    const state = await spawnAgent(options);

    expect(state.id).toBe('agent-pan-ccr-2');
    expect(state.model).toBe('gpt-5.2-codex'); // Model unchanged

    // Verify launcher script uses 'ccr' CLI
    const agentDir = getAgentDir(state.id);
    const launcherPath = join(agentDir, 'launcher.sh');
    expect(existsSync(launcherPath)).toBe(true);

    const launcherContent = readFileSync(launcherPath, 'utf-8');
    expect(launcherContent).toContain('exec ccr');
    expect(launcherContent).not.toContain('exec claude --');

    // No warning should be logged when ccr is available
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('should fall back to Anthropic model when ccr is missing for non-Anthropic models', async () => {
    // Mock ccr as NOT installed
    mockExec.mockImplementation((cmd: any, callback: any) => {
      setImmediate(() => callback(new Error('Command not found'), { stdout: '', stderr: '' }));
      return {} as any;
    });

    // Wait for cache to expire (5+ seconds)
    // This ensures the test is isolated from previous tests
    await new Promise(resolve => setTimeout(resolve, 5100));

    const options: SpawnOptions = {
      issueId: 'PAN-CCR-3',
      workspace: '/tmp/test-workspace',
      model: 'gemini-3-flash-preview',
      prompt: 'Test prompt for Google model',
    };

    const state = await spawnAgent(options);

    expect(state.id).toBe('agent-pan-ccr-3');

    // Model should have been changed to Anthropic fallback
    expect(state.model).toMatch(/^claude-/);
    expect(state.model).not.toBe('gemini-3-flash-preview');

    // Verify launcher script uses 'claude' CLI
    const agentDir = getAgentDir(state.id);
    const launcherPath = join(agentDir, 'launcher.sh');
    expect(existsSync(launcherPath)).toBe(true);

    const launcherContent = readFileSync(launcherPath, 'utf-8');
    expect(launcherContent).toContain('exec claude');
    expect(launcherContent).not.toContain('exec ccr');

    // Warning should be logged about fallback
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CCR not installed'),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('gemini-3-flash-preview'),
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back'),
    );
  });

  it('should handle different non-Anthropic providers correctly with ccr installed', async () => {
    // Wait for cache to expire from previous test
    await new Promise(resolve => setTimeout(resolve, 5100));

    // Mock ccr as installed
    mockExec.mockImplementation((cmd: any, callback: any) => {
      setImmediate(() => callback(null, { stdout: '/usr/local/bin/ccr', stderr: '' }));
      return {} as any;
    });

    // Test OpenAI
    const openaiOptions: SpawnOptions = {
      issueId: 'PAN-CCR-4',
      workspace: '/tmp/test-workspace',
      model: 'gpt-4o',
      prompt: 'Test OpenAI',
    };

    const openaiState = await spawnAgent(openaiOptions);
    expect(openaiState.model).toBe('gpt-4o');

    const openaiLauncher = readFileSync(join(getAgentDir(openaiState.id), 'launcher.sh'), 'utf-8');
    expect(openaiLauncher).toContain('exec ccr');

    // Reset for next test
    vi.clearAllMocks();
    mockExec.mockImplementation((cmd: any, callback: any) => {
      setImmediate(() => callback(null, { stdout: '/usr/local/bin/ccr', stderr: '' }));
      return {} as any;
    });

    // Test Zai
    const zaiOptions: SpawnOptions = {
      issueId: 'PAN-CCR-5',
      workspace: '/tmp/test-workspace',
      model: 'glm-4-plus',
      prompt: 'Test Zai',
    };

    const zaiState = await spawnAgent(zaiOptions);
    expect(zaiState.model).toBe('glm-4-plus');

    const zaiLauncher = readFileSync(join(getAgentDir(zaiState.id), 'launcher.sh'), 'utf-8');
    expect(zaiLauncher).toContain('exec ccr');
  });

  it('should verify launcher script includes correct model parameter', async () => {
    // Wait for cache to expire from previous test
    await new Promise(resolve => setTimeout(resolve, 5100));

    // Mock ccr as installed
    mockExec.mockImplementation((cmd: any, callback: any) => {
      setImmediate(() => callback(null, { stdout: '/usr/local/bin/ccr', stderr: '' }));
      return {} as any;
    });

    const options: SpawnOptions = {
      issueId: 'PAN-CCR-6',
      workspace: '/tmp/test-workspace',
      model: 'gpt-5.2-codex',
      prompt: 'Test model parameter',
    };

    const state = await spawnAgent(options);

    const launcherContent = readFileSync(join(getAgentDir(state.id), 'launcher.sh'), 'utf-8');

    // Should include --model flag with correct model
    expect(launcherContent).toContain('--model gpt-5.2-codex');

    // Should include --dangerously-skip-permissions flag
    expect(launcherContent).toContain('--dangerously-skip-permissions');
  });
});
