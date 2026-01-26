import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * CCR (claude-code-router) Module
 *
 * Handles detection and routing between:
 * - `claude` CLI: For Anthropic models (Sonnet, Opus, Haiku)
 * - `ccr` CLI: For non-Anthropic models (OpenAI, Google, Zai, etc.)
 *
 * Context: Agent spawning in agents.ts:396,401 incorrectly uses `claude` CLI
 * for all models, which silently ignores non-Anthropic models.
 */

// Cache for CCR installation status (avoid repeated checks)
let ccrInstalledCache: { value: boolean; timestamp: number } | null = null;
const CACHE_TTL_MS = 5000; // 5 seconds

/**
 * Check if CCR (claude-code-router) is installed and available
 * @returns true if ccr command is available in PATH
 */
export async function isCcrInstalled(): Promise<boolean> {
  // Check cache first
  const now = Date.now();
  if (ccrInstalledCache && now - ccrInstalledCache.timestamp < CACHE_TTL_MS) {
    return ccrInstalledCache.value;
  }

  // Try to run 'which ccr' to check if available
  try {
    await execAsync('which ccr');
    ccrInstalledCache = { value: true, timestamp: now };
    return true;
  } catch {
    ccrInstalledCache = { value: false, timestamp: now };
    return false;
  }
}

/**
 * Determine which CLI to use for a given model
 * @param model - Model identifier (e.g., "claude-sonnet-4-5", "gpt-4", "gemini-pro")
 * @returns CLI choice and reason
 */
export async function getCliForModel(model: string): Promise<{ cli: 'ccr' | 'claude'; reason: string }> {
  const provider = getModelProvider(model);

  // Anthropic models always use native claude CLI
  if (provider === 'anthropic') {
    return { cli: 'claude', reason: 'anthropic-native' };
  }

  // Non-Anthropic models need CCR
  const ccrAvailable = await isCcrInstalled();
  if (ccrAvailable) {
    return { cli: 'ccr', reason: 'ccr-available' };
  }

  // Fallback: CCR not installed, use claude CLI (will log warning)
  return { cli: 'claude', reason: 'ccr-missing-fallback' };
}

/**
 * Determine the provider for a given model
 * @param model - Model identifier
 * @returns Provider name
 */
export function getModelProvider(model: string): 'anthropic' | 'openai' | 'google' | 'zai' | 'unknown' {
  const lowerModel = model.toLowerCase();

  // Anthropic models: claude-* or anthropic-*
  if (lowerModel.startsWith('claude-') || lowerModel.startsWith('anthropic-')) {
    return 'anthropic';
  }

  // OpenAI models: gpt-*, o1-*, o3-*
  if (lowerModel.startsWith('gpt-') || lowerModel.startsWith('o1-') || lowerModel.startsWith('o3-')) {
    return 'openai';
  }

  // Google models: gemini-*
  if (lowerModel.startsWith('gemini-')) {
    return 'google';
  }

  // Zai models: glm-*
  if (lowerModel.startsWith('glm-')) {
    return 'zai';
  }

  // Default to anthropic for unknown models (safe default)
  return 'anthropic';
}
