import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process module before importing ccr
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('ccr', () => {
  // Need to dynamically import to reset module state between tests
  let getModelProvider: any;
  let isCcrInstalled: any;
  let getCliForModel: any;
  let mockExec: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules(); // Clear module cache to reset internal state

    // Re-import the module fresh
    const ccr = await import('../../src/lib/ccr.js');
    getModelProvider = ccr.getModelProvider;
    isCcrInstalled = ccr.isCcrInstalled;
    getCliForModel = ccr.getCliForModel;

    // Get mock after module import
    const childProcess = await import('child_process');
    mockExec = vi.mocked(childProcess.exec);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getModelProvider', () => {
    it('should return anthropic for Claude models', () => {
      expect(getModelProvider('claude-opus-4-5')).toBe('anthropic');
      expect(getModelProvider('claude-sonnet-4-5')).toBe('anthropic');
      expect(getModelProvider('claude-haiku-4-5')).toBe('anthropic');
      expect(getModelProvider('Claude-Opus-4-5')).toBe('anthropic'); // Case insensitive
    });

    it('should return anthropic for models with anthropic prefix', () => {
      expect(getModelProvider('anthropic-claude-opus')).toBe('anthropic');
    });

    it('should return openai for GPT models', () => {
      expect(getModelProvider('gpt-5.2-codex')).toBe('openai');
      expect(getModelProvider('gpt-4o')).toBe('openai');
      expect(getModelProvider('gpt-4o-mini')).toBe('openai');
      expect(getModelProvider('GPT-5.2-Codex')).toBe('openai'); // Case insensitive
    });

    it('should return openai for O1/O3 models', () => {
      expect(getModelProvider('o1-preview')).toBe('openai');
      expect(getModelProvider('o3-deep-research')).toBe('openai');
    });

    it('should return google for Gemini models', () => {
      expect(getModelProvider('gemini-3-pro-preview')).toBe('google');
      expect(getModelProvider('gemini-3-flash-preview')).toBe('google');
      expect(getModelProvider('Gemini-3-Flash')).toBe('google'); // Case insensitive
    });

    it('should return zai for GLM models', () => {
      expect(getModelProvider('glm-4-plus')).toBe('zai');
      expect(getModelProvider('glm-4.7')).toBe('zai');
      expect(getModelProvider('GLM-4-Plus')).toBe('zai'); // Case insensitive
    });

    it('should return anthropic as default for unknown models', () => {
      expect(getModelProvider('unknown-model')).toBe('anthropic');
      expect(getModelProvider('some-random-123')).toBe('anthropic');
      expect(getModelProvider('')).toBe('anthropic');
    });
  });

  describe('isCcrInstalled', () => {
    it('should return true when ccr is found', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        // Simulate successful which ccr
        setImmediate(() => callback(null, { stdout: '/usr/local/bin/ccr', stderr: '' }));
        return {} as any;
      });

      const result = await isCcrInstalled();
      expect(result).toBe(true);
    });

    it('should return false when ccr is not found', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        // Simulate command not found
        setImmediate(() => callback(new Error('Command not found'), { stdout: '', stderr: '' }));
        return {} as any;
      });

      const result = await isCcrInstalled();
      expect(result).toBe(false);
    });

    it('should cache the result for subsequent calls', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        setImmediate(() => callback(null, { stdout: '/usr/local/bin/ccr', stderr: '' }));
        return {} as any;
      });

      // First call
      const result1 = await isCcrInstalled();
      expect(result1).toBe(true);
      const callCount1 = mockExec.mock.calls.length;

      // Second call should use cache
      const result2 = await isCcrInstalled();
      expect(result2).toBe(true);
      const callCount2 = mockExec.mock.calls.length;

      // Verify cache was used (no additional exec call)
      expect(callCount2).toBe(callCount1);
    });
  });

  describe('getCliForModel', () => {
    it('should return claude CLI for Anthropic models', async () => {
      // No need to mock exec for Anthropic models
      const result = await getCliForModel('claude-sonnet-4-5');
      expect(result).toEqual({
        cli: 'claude',
        reason: 'anthropic-native',
      });
    });

    it('should return ccr CLI when ccr is available for non-Anthropic models', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        setImmediate(() => callback(null, { stdout: '/usr/local/bin/ccr', stderr: '' }));
        return {} as any;
      });

      const result = await getCliForModel('gpt-5.2-codex');
      expect(result).toEqual({
        cli: 'ccr',
        reason: 'ccr-available',
      });
    });

    it('should return claude CLI with fallback reason when ccr is missing for non-Anthropic models', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        setImmediate(() => callback(new Error('Command not found'), { stdout: '', stderr: '' }));
        return {} as any;
      });

      const result = await getCliForModel('gemini-3-flash-preview');
      expect(result).toEqual({
        cli: 'claude',
        reason: 'ccr-missing-fallback',
      });
    });

    it('should handle different provider models correctly', async () => {
      mockExec.mockImplementation((cmd: any, callback: any) => {
        setImmediate(() => callback(null, { stdout: '/usr/local/bin/ccr', stderr: '' }));
        return {} as any;
      });

      // OpenAI model
      const openaiResult = await getCliForModel('gpt-4o');
      expect(openaiResult.cli).toBe('ccr');
      expect(openaiResult.reason).toBe('ccr-available');

      // Google model (reusing same mock)
      const googleResult = await getCliForModel('gemini-3-pro-preview');
      expect(googleResult.cli).toBe('ccr');

      // Zai model (reusing same mock)
      const zaiResult = await getCliForModel('glm-4-plus');
      expect(zaiResult.cli).toBe('ccr');
    });
  });
});
