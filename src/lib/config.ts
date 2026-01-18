import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse, stringify } from '@iarna/toml';
import { CONFIG_FILE } from './paths.js';

export interface PanopticonConfig {
  panopticon: {
    version: string;
  };
  sync: {
    targets: string[];  // 'claude', 'codex', 'cursor', 'gemini'
    backup_before_sync: boolean;
  };
  trackers: {
    primary: string;  // 'linear' or 'github'
    secondary?: string;
  };
  dashboard: {
    port: number;
    api_port: number;
  };
}

const DEFAULT_CONFIG: PanopticonConfig = {
  panopticon: {
    version: '1.0.0',
  },
  sync: {
    targets: ['claude'],
    backup_before_sync: true,
  },
  trackers: {
    primary: 'linear',
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
  return { ...DEFAULT_CONFIG };
}
