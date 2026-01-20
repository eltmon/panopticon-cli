/**
 * Cursor Runtime Adapter
 *
 * Adapter for Cursor AI code editor
 */

import { existsSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, lstatSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type {
  RuntimeAdapter,
  RuntimeConfig,
  RuntimeType,
  AgentSpawnOptions,
  AgentStatus,
  AgentMessage,
} from './interface.js';
import { CURSOR_FEATURES } from './interface.js';

const CURSOR_DIR = join(homedir(), '.cursor');

export function createCursorAdapter(): RuntimeAdapter {
  const config: RuntimeConfig = {
    type: 'cursor',
    name: 'Cursor',
    configDir: CURSOR_DIR,
    skillsDir: join(CURSOR_DIR, 'skills'),
    executable: 'cursor',
    apiKeyEnv: 'CURSOR_API_KEY',
    features: CURSOR_FEATURES,
  };

  return {
    type: 'cursor' as RuntimeType,
    config,

    async isAvailable(): Promise<boolean> {
      // Cursor is a GUI app, check if config directory exists
      return existsSync(CURSOR_DIR);
    },

    async getVersion(): Promise<string | null> {
      // Cursor version would need to be read from app metadata
      return null;
    },

    async initialize(): Promise<void> {
      mkdirSync(config.skillsDir, { recursive: true });
    },

    async spawnAgent(_id: string, _options: AgentSpawnOptions): Promise<boolean> {
      // Cursor doesn't support headless agent spawning
      console.error('Cursor does not support headless agent spawning');
      return false;
    },

    async sendMessage(_id: string, _message: AgentMessage): Promise<boolean> {
      // Cursor doesn't support programmatic message sending
      console.error('Cursor does not support programmatic message sending');
      return false;
    },

    async getAgentStatus(_id: string): Promise<AgentStatus | null> {
      // Cursor agents are GUI-based
      return null;
    },

    async stopAgent(_id: string): Promise<boolean> {
      // Cursor agents are GUI-based
      return false;
    },

    async listAgents(): Promise<AgentStatus[]> {
      // Cursor agents are GUI-based
      return [];
    },

    async syncSkills(sourceDir: string, force?: boolean): Promise<number> {
      if (!existsSync(sourceDir)) return 0;

      mkdirSync(config.skillsDir, { recursive: true });

      let synced = 0;
      const skills = readdirSync(sourceDir, { withFileTypes: true })
        .filter(d => d.isDirectory());

      for (const skill of skills) {
        const sourcePath = join(sourceDir, skill.name);
        const targetPath = join(config.skillsDir, skill.name);

        if (!existsSync(join(sourcePath, 'SKILL.md'))) {
          continue;
        }

        if (existsSync(targetPath)) {
          if (!force) {
            try {
              const stats = lstatSync(targetPath);
              if (!stats.isSymbolicLink()) {
                continue;
              }
            } catch {
              continue;
            }
          }
          try {
            unlinkSync(targetPath);
          } catch {
            continue;
          }
        }

        try {
          symlinkSync(sourcePath, targetPath);
          synced++;
        } catch {
          // Symlink failed
        }
      }

      return synced;
    },

    getSkillsDir(): string {
      return config.skillsDir;
    },
  };
}
