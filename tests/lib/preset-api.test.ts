import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPresetModels,
  getAvailableModels,
  isValidPreset,
  type PresetName,
  type ModelProvider,
} from '../../src/lib/model-presets.js';

describe('Preset API Functions', () => {
  describe('isValidPreset', () => {
    it('should return true for valid presets', () => {
      expect(isValidPreset('premium')).toBe(true);
      expect(isValidPreset('balanced')).toBe(true);
      expect(isValidPreset('budget')).toBe(true);
    });

    it('should return false for invalid presets', () => {
      expect(isValidPreset('invalid')).toBe(false);
      expect(isValidPreset('custom')).toBe(false);
      expect(isValidPreset('')).toBe(false);
      expect(isValidPreset('Premium')).toBe(false); // Case sensitive
    });
  });

  describe('getPresetModels', () => {
    it('should return correct structure for premium preset', () => {
      const result = getPresetModels('premium');

      expect(result).toHaveProperty('preset', 'premium');
      expect(result).toHaveProperty('displayName');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('costLevel');
      expect(result).toHaveProperty('models');

      expect(result.displayName).toBe('Premium');
      expect(result.costLevel).toBe(5);
      expect(typeof result.models).toBe('object');
    });

    it('should return correct structure for balanced preset', () => {
      const result = getPresetModels('balanced');

      expect(result.preset).toBe('balanced');
      expect(result.displayName).toBe('Balanced');
      expect(result.costLevel).toBe(3);
    });

    it('should return correct structure for budget preset', () => {
      const result = getPresetModels('budget');

      expect(result.preset).toBe('budget');
      expect(result.displayName).toBe('Budget');
      expect(result.costLevel).toBe(1);
    });

    it('should include provider and cost tier for each model', () => {
      const result = getPresetModels('balanced');

      // Check a few work types to verify structure
      const issueAgentPlanningModel = result.models['issue-agent:planning'];
      expect(issueAgentPlanningModel).toHaveProperty('model');
      expect(issueAgentPlanningModel).toHaveProperty('provider');
      expect(issueAgentPlanningModel).toHaveProperty('costTier');

      expect(typeof issueAgentPlanningModel.model).toBe('string');
      expect(['anthropic', 'openai', 'google', 'zai']).toContain(issueAgentPlanningModel.provider);
      expect([1, 2, 3, 4, 5]).toContain(issueAgentPlanningModel.costTier);
    });

    it('should have all required work types', () => {
      const result = getPresetModels('balanced');

      // Verify key work types are present
      expect(result.models).toHaveProperty('issue-agent:exploration');
      expect(result.models).toHaveProperty('issue-agent:planning');
      expect(result.models).toHaveProperty('issue-agent:implementation');
      expect(result.models).toHaveProperty('specialist-review-agent');
      expect(result.models).toHaveProperty('subagent:explore');
      expect(result.models).toHaveProperty('cli:interactive');
    });

    it('should assign correct provider to Anthropic models', () => {
      const result = getPresetModels('balanced');

      // Find a model we know is Anthropic
      const workTypes = Object.keys(result.models);
      const anthropicWorkType = workTypes.find(
        (wt) => result.models[wt as keyof typeof result.models].model.startsWith('claude-')
      );

      if (anthropicWorkType) {
        const modelInfo = result.models[anthropicWorkType as keyof typeof result.models];
        expect(modelInfo.provider).toBe('anthropic');
      }
    });

    it('should assign higher cost tiers to premium models', () => {
      const budgetResult = getPresetModels('budget');
      const premiumResult = getPresetModels('premium');

      // Premium should generally have higher cost tiers
      const budgetAvgCost =
        Object.values(budgetResult.models).reduce((sum, m) => sum + m.costTier, 0) /
        Object.keys(budgetResult.models).length;
      const premiumAvgCost =
        Object.values(premiumResult.models).reduce((sum, m) => sum + m.costTier, 0) /
        Object.keys(premiumResult.models).length;

      expect(premiumAvgCost).toBeGreaterThan(budgetAvgCost);
    });
  });

  describe('getAvailableModels', () => {
    it('should always include Anthropic models', () => {
      const emptyProviders = new Set<ModelProvider>();
      const result = getAvailableModels(emptyProviders);

      expect(result.anthropic).toHaveLength(3);
      expect(result.anthropic).toContain('claude-opus-4-5');
      expect(result.anthropic).toContain('claude-sonnet-4-5');
      expect(result.anthropic).toContain('claude-haiku-4-5');
    });

    it('should return empty arrays for disabled providers', () => {
      const onlyAnthropicProviders = new Set<ModelProvider>(['anthropic']);
      const result = getAvailableModels(onlyAnthropicProviders);

      expect(result.openai).toEqual([]);
      expect(result.google).toEqual([]);
      expect(result.zai).toEqual([]);
    });

    it('should include OpenAI models when enabled', () => {
      const providersWithOpenAI = new Set<ModelProvider>(['anthropic', 'openai']);
      const result = getAvailableModels(providersWithOpenAI);

      expect(result.openai).toHaveLength(4);
      expect(result.openai).toContain('gpt-5.2-codex');
      expect(result.openai).toContain('gpt-4o');
      expect(result.openai).toContain('gpt-4o-mini');
      expect(result.openai).toContain('o3-deep-research');
    });

    it('should include Google models when enabled', () => {
      const providersWithGoogle = new Set<ModelProvider>(['anthropic', 'google']);
      const result = getAvailableModels(providersWithGoogle);

      expect(result.google).toHaveLength(2);
      expect(result.google).toContain('gemini-3-pro-preview');
      expect(result.google).toContain('gemini-3-flash-preview');
    });

    it('should include Zai models when enabled', () => {
      const providersWithZai = new Set<ModelProvider>(['anthropic', 'zai']);
      const result = getAvailableModels(providersWithZai);

      expect(result.zai).toHaveLength(1);
      expect(result.zai).toContain('glm-4-plus');
    });

    it('should include all models when all providers enabled', () => {
      const allProviders = new Set<ModelProvider>(['anthropic', 'openai', 'google', 'zai']);
      const result = getAvailableModels(allProviders);

      expect(result.anthropic.length).toBeGreaterThan(0);
      expect(result.openai.length).toBeGreaterThan(0);
      expect(result.google.length).toBeGreaterThan(0);
      expect(result.zai.length).toBeGreaterThan(0);

      // Verify total count
      const totalModels =
        result.anthropic.length + result.openai.length + result.google.length + result.zai.length;
      expect(totalModels).toBe(10); // 3 + 4 + 2 + 1
    });

    it('should handle mixed provider sets correctly', () => {
      const mixedProviders = new Set<ModelProvider>(['anthropic', 'openai', 'google']);
      const result = getAvailableModels(mixedProviders);

      expect(result.anthropic.length).toBe(3);
      expect(result.openai.length).toBe(4);
      expect(result.google.length).toBe(2);
      expect(result.zai).toEqual([]);
    });
  });

  describe('API Response Format', () => {
    it('should match expected API response structure for preset endpoint', () => {
      // Simulating GET /api/settings/presets/:preset response
      const apiResponse = getPresetModels('balanced');

      // Verify the response can be JSON serialized (no functions, symbols, etc.)
      const serialized = JSON.stringify(apiResponse);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual(apiResponse);
    });

    it('should match expected API response structure for available models endpoint', () => {
      // Simulating GET /api/settings/available-models response
      const enabledProviders = new Set<ModelProvider>(['anthropic', 'openai']);
      const apiResponse = getAvailableModels(enabledProviders);

      // Verify the response can be JSON serialized
      const serialized = JSON.stringify(apiResponse);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual(apiResponse);
    });
  });
});
