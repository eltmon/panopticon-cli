import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse, stringify } from '@iarna/toml';
import { CONFIG_FILE } from './paths.js';
import type { TrackerType } from './tracker/interface.js';

// Individual tracker configuration
export interface LinearConfig {
  type: 'linear';
  api_key_env?: string;  // Env var name for API key (default: LINEAR_API_KEY)
  team?: string;         // Default team prefix (e.g., 'MIN')
}

export interface GitHubConfig {
  type: 'github';
  token_env?: string;    // Env var name for token (default: GITHUB_TOKEN)
  owner: string;         // Repository owner
  repo: string;          // Repository name
}

export interface GitLabConfig {
  type: 'gitlab';
  token_env?: string;    // Env var name for token (default: GITLAB_TOKEN)
  project_id: string;    // GitLab project ID
}

export type TrackerConfigItem = LinearConfig | GitHubConfig | GitLabConfig;

export interface TrackersConfig {
  primary: TrackerType;
  secondary?: TrackerType;
  linear?: LinearConfig;
  github?: GitHubConfig;
  gitlab?: GitLabConfig;
}

export interface PanopticonConfig {
  panopticon: {
    version: string;
  };
  sync: {
    targets: string[];  // 'claude', 'codex', 'cursor', 'gemini'
    backup_before_sync: boolean;
    auto_sync?: boolean;
    strategy?: 'symlink' | 'copy';
  };
  trackers: TrackersConfig;
  dashboard: {
    port: number;
    api_port: number;
  };
  traefik?: {
    enabled: boolean;
    dashboard_port?: number;
    domain?: string;
  };
}

const DEFAULT_CONFIG: PanopticonConfig = {
  panopticon: {
    version: '1.0.0',
  },
  sync: {
    targets: ['claude'],
    backup_before_sync: true,
    auto_sync: false,
    strategy: 'symlink',
  },
  trackers: {
    primary: 'linear',
    linear: {
      type: 'linear',
      api_key_env: 'LINEAR_API_KEY',
    },
  },
  dashboard: {
    port: 3001,
    api_port: 3002,
  },
};

export function loadConfig(): PanopticonConfig {
  if (!existsSync(CONFIG_FILE)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf8');
    const parsed = parse(content) as unknown as PanopticonConfig;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (error) {
    console.error('Warning: Failed to parse config, using defaults');
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: PanopticonConfig): void {
  const content = stringify(config as any);
  writeFileSync(CONFIG_FILE, content, 'utf8');
}

export function getDefaultConfig(): PanopticonConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
