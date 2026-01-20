/**
 * Gemini CLI Runtime Adapter
 *
 * Adapter for Google's Gemini CLI
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
import { GEMINI_FEATURES } from './interface.js';

const GEMINI_DIR = join(homedir(), '.gemini');

export function createGeminiAdapter(): RuntimeAdapter {
  const config: RuntimeConfig = {
    type: 'gemini',
    name: 'Gemini CLI',
    configDir: GEMINI_DIR,
    skillsDir: join(GEMINI_DIR, 'skills'),
    executable: 'gemini',
    apiKeyEnv: 'GOOGLE_API_KEY',
    features: GEMINI_FEATURES,
  };

  return {
    type: 'gemini' as RuntimeType,
    config,

    async isAvailable(): Promise<boolean> {
      try {
        const { execa } = await import('execa');
        const result = await execa('which', ['gemini']);
        return result.exitCode === 0;
      } catch {
        return false;
      }
    },

    async getVersion(): Promise<string | null> {
      try {
        const { execa } = await import('execa');
        const result = await execa('gemini', ['--version']);
        return result.stdout.trim();
      } catch {
        return null;
      }
    },

    async initialize(): Promise<void> {
      mkdirSync(config.skillsDir, { recursive: true });
    },

    async spawnAgent(id: string, options: AgentSpawnOptions): Promise<boolean> {
      try {
        const { execa } = await import('execa');

        const sessionName = `agent-${id}`;
        const geminiCmd = `cd "${options.workingDir}" && gemini`;

        await execa('tmux', [
          'new-session',
          '-d',
          '-s', sessionName,
          'bash', '-c', geminiCmd,
        ]);

        // Wait then send prompt
        await new Promise(resolve => setTimeout(resolve, 1000));

        await execa('tmux', ['send-keys', '-t', sessionName, options.prompt]);
        await execa('tmux', ['send-keys', '-t', sessionName, 'Enter']);

        return true;
      } catch (error) {
        console.error('Failed to spawn Gemini agent:', error);
        return false;
      }
    },

    async sendMessage(id: string, message: AgentMessage): Promise<boolean> {
      try {
        const { execa } = await import('execa');
        const sessionName = `agent-${id}`;

        await execa('tmux', ['send-keys', '-t', sessionName, message.content]);
        await execa('tmux', ['send-keys', '-t', sessionName, 'Enter']);

        return true;
      } catch {
        return false;
      }
    },

    async getAgentStatus(id: string): Promise<AgentStatus | null> {
      try {
        const { execa } = await import('execa');
        const sessionName = `agent-${id}`;

        const result = await execa('tmux', ['has-session', '-t', sessionName], {
          reject: false,
        });

        if (result.exitCode !== 0) {
          return null;
        }

        return {
          id,
          runtime: 'gemini',
          status: 'running',
          startedAt: new Date().toISOString(),
        };
      } catch {
        return null;
      }
    },

    async stopAgent(id: string): Promise<boolean> {
      try {
        const { execa } = await import('execa');
        await execa('tmux', ['kill-session', '-t', `agent-${id}`]);
        return true;
      } catch {
        return false;
      }
    },

    async listAgents(): Promise<AgentStatus[]> {
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
