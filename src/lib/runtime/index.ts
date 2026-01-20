/**
 * Multi-Runtime Architecture
 *
 * Export all runtime adapters and provide a unified registry
 */

export * from './interface.js';
export { createClaudeAdapter } from './claude.js';
export { createCodexAdapter } from './codex.js';
export { createCursorAdapter } from './cursor.js';
export { createGeminiAdapter } from './gemini.js';

import type { RuntimeAdapter, RuntimeType, RuntimeRegistry } from './interface.js';
import { createClaudeAdapter } from './claude.js';
import { createCodexAdapter } from './codex.js';
import { createCursorAdapter } from './cursor.js';
import { createGeminiAdapter } from './gemini.js';

/**
 * Create a runtime registry with all built-in adapters
 */
export function createRuntimeRegistry(): RuntimeRegistry {
  const adapters = new Map<RuntimeType, RuntimeAdapter>();

  // Register built-in adapters
  const claude = createClaudeAdapter();
  const codex = createCodexAdapter();
  const cursor = createCursorAdapter();
  const gemini = createGeminiAdapter();

  adapters.set('claude', claude);
  adapters.set('codex', codex);
  adapters.set('cursor', cursor);
  adapters.set('gemini', gemini);

  return {
    register(adapter: RuntimeAdapter): void {
      adapters.set(adapter.type, adapter);
    },

    get(type: RuntimeType): RuntimeAdapter | undefined {
      return adapters.get(type);
    },

    getAll(): RuntimeAdapter[] {
      return Array.from(adapters.values());
    },

    async getAvailable(): Promise<RuntimeAdapter[]> {
      const available: RuntimeAdapter[] = [];

      for (const adapter of adapters.values()) {
        if (await adapter.isAvailable()) {
          available.push(adapter);
        }
      }

      return available;
    },

    async syncToAll(sourceDir: string, force?: boolean): Promise<Map<RuntimeType, number>> {
      const results = new Map<RuntimeType, number>();

      for (const adapter of adapters.values()) {
        try {
          const synced = await adapter.syncSkills(sourceDir, force);
          results.set(adapter.type, synced);
        } catch (error) {
          console.error(`Failed to sync to ${adapter.type}:`, error);
          results.set(adapter.type, 0);
        }
      }

      return results;
    },
  };
}

/**
 * Get a runtime adapter by type
 */
export function getRuntimeAdapter(type: RuntimeType): RuntimeAdapter {
  switch (type) {
    case 'claude':
      return createClaudeAdapter();
    case 'codex':
      return createCodexAdapter();
    case 'cursor':
      return createCursorAdapter();
    case 'gemini':
      return createGeminiAdapter();
    default:
      throw new Error(`Unknown runtime type: ${type}`);
  }
}

/**
 * Get all supported runtime types
 */
export function getSupportedRuntimes(): RuntimeType[] {
  return ['claude', 'codex', 'cursor', 'gemini'];
}

/**
 * Check if a runtime is installed
 */
export async function isRuntimeInstalled(type: RuntimeType): Promise<boolean> {
  const adapter = getRuntimeAdapter(type);
  return adapter.isAvailable();
}

/**
 * Get installed runtimes
 */
export async function getInstalledRuntimes(): Promise<RuntimeType[]> {
  const installed: RuntimeType[] = [];

  for (const type of getSupportedRuntimes()) {
    if (await isRuntimeInstalled(type)) {
      installed.push(type);
    }
  }

  return installed;
}
