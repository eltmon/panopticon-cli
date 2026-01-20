/**
 * Codex Runtime Adapter
 *
 * Adapter for OpenAI Codex CLI
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
import { CODEX_FEATURES } from './interface.js';

const CODEX_DIR = join(homedir(), '.codex');

export function createCodexAdapter(): RuntimeAdapter {
  const config: RuntimeConfig = {
    type: 'codex',
    name: 'OpenAI Codex',
    configDir: CODEX_DIR,
    skillsDir: join(CODEX_DIR, 'skills'),
    executable: 'codex',
    apiKeyEnv: 'OPENAI_API_KEY',
    features: CODEX_FEATURES,
  };

  return {
    type: 'codex' as RuntimeType,
    config,

    async isAvailable(): Promise<boolean> {
      try {
        const { execa } = await import('execa');
        const result = await execa('which', ['codex']);
        return result.exitCode === 0;
      } catch {
        return false;
      }
    },

    async getVersion(): Promise<string | null> {
      try {
        const { execa } = await import('execa');
        const result = await execa('codex', ['--version']);
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
        const codexCmd = `cd "${options.workingDir}" && codex`;

        await execa('tmux', [
          'new-session',
          '-d',
          '-s', sessionName,
          'bash', '-c', codexCmd,
        ]);

        // Wait then send prompt
        await new Promise(resolve => setTimeout(resolve, 1000));

        await execa('tmux', ['send-keys', '-t', sessionName, options.prompt]);
        await execa('tmux', ['send-keys', '-t', sessionName, 'Enter']);

        return true;
      } catch (error) {
        console.error('Failed to spawn Codex agent:', error);
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
          runtime: 'codex',
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
      // Codex agents share tmux with other runtimes
      // Would need additional tracking to differentiate
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
