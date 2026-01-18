import { homedir } from 'os';
import { join } from 'path';

// Panopticon home directory
export const PANOPTICON_HOME = join(homedir(), '.panopticon');

// Subdirectories
export const CONFIG_DIR = PANOPTICON_HOME;
export const SKILLS_DIR = join(PANOPTICON_HOME, 'skills');
export const COMMANDS_DIR = join(PANOPTICON_HOME, 'commands');
export const AGENTS_DIR = join(PANOPTICON_HOME, 'agents');
export const BACKUPS_DIR = join(PANOPTICON_HOME, 'backups');
export const COSTS_DIR = join(PANOPTICON_HOME, 'costs');

// Config files
export const CONFIG_FILE = join(CONFIG_DIR, 'config.toml');

// AI tool directories
export const CLAUDE_DIR = join(homedir(), '.claude');
export const CODEX_DIR = join(homedir(), '.codex');
export const CURSOR_DIR = join(homedir(), '.cursor');
export const GEMINI_DIR = join(homedir(), '.gemini');

// Target sync locations
export const SYNC_TARGETS = {
  claude: {
    skills: join(CLAUDE_DIR, 'skills'),
    commands: join(CLAUDE_DIR, 'commands'),
  },
  codex: {
    skills: join(CODEX_DIR, 'skills'),
    commands: join(CODEX_DIR, 'commands'),
  },
  cursor: {
    skills: join(CURSOR_DIR, 'skills'),
    commands: join(CURSOR_DIR, 'commands'),
  },
  gemini: {
    skills: join(GEMINI_DIR, 'skills'),
    commands: join(GEMINI_DIR, 'commands'),
  },
} as const;

export type Runtime = keyof typeof SYNC_TARGETS;

// Templates directory
export const TEMPLATES_DIR = join(PANOPTICON_HOME, 'templates');
export const CLAUDE_MD_TEMPLATES = join(TEMPLATES_DIR, 'claude-md', 'sections');

// All directories to create on init
export const INIT_DIRS = [
  PANOPTICON_HOME,
  SKILLS_DIR,
  COMMANDS_DIR,
  AGENTS_DIR,
  BACKUPS_DIR,
  COSTS_DIR,
  TEMPLATES_DIR,
  CLAUDE_MD_TEMPLATES,
];
