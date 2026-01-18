import { existsSync, mkdirSync, readdirSync, symlinkSync, unlinkSync, lstatSync, readlinkSync } from 'fs';
import { join, basename } from 'path';
import { SKILLS_DIR, COMMANDS_DIR, SYNC_TARGETS, type Runtime } from './paths.js';

export interface SyncItem {
  name: string;
  sourcePath: string;
  targetPath: string;
  status: 'new' | 'exists' | 'conflict' | 'symlink';
}

export interface SyncPlan {
  runtime: Runtime;
  skills: SyncItem[];
  commands: SyncItem[];
}

/**
 * Check if a path is a Panopticon-managed symlink
 */
export function isPanopticonSymlink(targetPath: string): boolean {
  if (!existsSync(targetPath)) return false;

  try {
    const stats = lstatSync(targetPath);
    if (!stats.isSymbolicLink()) return false;

    const linkTarget = readlinkSync(targetPath);
    // It's ours if it points to our skills/commands dir
    return linkTarget.includes('.panopticon');
  } catch {
    return false;
  }
}

/**
 * Plan what would be synced (dry run)
 */
export function planSync(runtime: Runtime): SyncPlan {
  const targets = SYNC_TARGETS[runtime];
  const plan: SyncPlan = {
    runtime,
    skills: [],
    commands: [],
  };

  // Plan skills sync
  if (existsSync(SKILLS_DIR)) {
    const skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const skill of skills) {
      const sourcePath = join(SKILLS_DIR, skill.name);
      const targetPath = join(targets.skills, skill.name);

      let status: SyncItem['status'] = 'new';

      if (existsSync(targetPath)) {
        if (isPanopticonSymlink(targetPath)) {
          status = 'symlink';  // Already managed by us
        } else {
          status = 'conflict';  // User content exists
        }
      }

      plan.skills.push({ name: skill.name, sourcePath, targetPath, status });
    }
  }

  // Plan commands sync
  if (existsSync(COMMANDS_DIR)) {
    const commands = readdirSync(COMMANDS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const cmd of commands) {
      const sourcePath = join(COMMANDS_DIR, cmd.name);
      const targetPath = join(targets.commands, cmd.name);

      let status: SyncItem['status'] = 'new';

      if (existsSync(targetPath)) {
        if (isPanopticonSymlink(targetPath)) {
          status = 'symlink';
        } else {
          status = 'conflict';
        }
      }

      plan.commands.push({ name: cmd.name, sourcePath, targetPath, status });
    }
  }

  return plan;
}

export interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
}

export interface SyncResult {
  created: string[];
  skipped: string[];
  conflicts: string[];
}

/**
 * Execute sync for a runtime
 */
export function executeSync(runtime: Runtime, options: SyncOptions = {}): SyncResult {
  const plan = planSync(runtime);
  const result: SyncResult = {
    created: [],
    skipped: [],
    conflicts: [],
  };

  const targets = SYNC_TARGETS[runtime];

  // Ensure target directories exist
  mkdirSync(targets.skills, { recursive: true });
  mkdirSync(targets.commands, { recursive: true });

  // Process skills
  for (const item of plan.skills) {
    if (options.dryRun) {
      if (item.status === 'new' || item.status === 'symlink') {
        result.created.push(item.name);
      } else {
        result.conflicts.push(item.name);
      }
      continue;
    }

    if (item.status === 'conflict' && !options.force) {
      result.conflicts.push(item.name);
      continue;
    }

    // Remove existing if force or if it's our symlink
    if (existsSync(item.targetPath)) {
      unlinkSync(item.targetPath);
    }

    // Create symlink
    symlinkSync(item.sourcePath, item.targetPath);
    result.created.push(item.name);
  }

  // Process commands
  for (const item of plan.commands) {
    if (options.dryRun) {
      if (item.status === 'new' || item.status === 'symlink') {
        result.created.push(item.name);
      } else {
        result.conflicts.push(item.name);
      }
      continue;
    }

    if (item.status === 'conflict' && !options.force) {
      result.conflicts.push(item.name);
      continue;
    }

    if (existsSync(item.targetPath)) {
      unlinkSync(item.targetPath);
    }

    symlinkSync(item.sourcePath, item.targetPath);
    result.created.push(item.name);
  }

  return result;
}
