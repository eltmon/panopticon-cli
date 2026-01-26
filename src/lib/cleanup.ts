import { readdirSync, statSync, rmSync, existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { AGENTS_DIR } from './paths.js';
import { getAgentState } from './agents.js';
import type { AgentState } from './agents.js';

export interface CleanupResult {
  deleted: string[];
  count: number;
  dryRun: boolean;
  errors: { agent: string; error: string }[];
}

/**
 * Get age threshold from config or use default
 */
export function getCleanupAgeThresholdDays(): number {
  const envFile = join(homedir(), '.panopticon.env');
  if (existsSync(envFile)) {
    const content = readFileSync(envFile, 'utf-8');
    const match = content.match(/CLEANUP_AGENT_DAYS=(\d+)/);
    if (match) {
      const days = parseInt(match[1], 10);
      if (!isNaN(days) && days > 0) {
        return days;
      }
    }
  }
  return 7; // Default: 7 days
}

/**
 * Check if an agent directory name matches patterns that should be cleaned
 */
function matchesCleanablePattern(dirName: string): boolean {
  // Include patterns
  const includePatterns = [
    /^agent-/,
    /^planning-/,
    /^specialist-/,
    /^test-agent-/,
  ];

  // Exclude patterns
  const excludePatterns = [
    /^main-cli$/,
  ];

  // Check exclusions first
  for (const pattern of excludePatterns) {
    if (pattern.test(dirName)) {
      return false;
    }
  }

  // Check inclusions
  for (const pattern of includePatterns) {
    if (pattern.test(dirName)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the age of an agent directory in days
 * Uses state.json timestamps (lastActivity or startedAt), falling back to directory mtime
 */
function getAgentAgeDays(
  dirPath: string,
  state: AgentState | null
): number {
  let mostRecentTimestamp: number | null = null;

  try {
    // Use provided state or try to read state.json
    if (state?.lastActivity) {
      mostRecentTimestamp = new Date(state.lastActivity).getTime();
    } else if (state?.startedAt) {
      // Fallback to startedAt if no lastActivity
      mostRecentTimestamp = new Date(state.startedAt).getTime();
    }

    // If no state timestamps, fall back to directory mtime
    if (mostRecentTimestamp === null) {
      const stats = statSync(dirPath);
      mostRecentTimestamp = stats.mtimeMs;
    }
  } catch (error) {
    // If we can't read stats or state, use current time (age = 0)
    return 0;
  }

  const nowMs = Date.now();
  const ageDays = (nowMs - mostRecentTimestamp) / (1000 * 60 * 60 * 24);
  return ageDays;
}

/**
 * Check if an agent should be cleaned based on its state and age
 */
export function shouldCleanAgent(
  dirName: string,
  state: AgentState | null,
  ageThresholdDays: number
): boolean {
  // Must match cleanable pattern
  if (!matchesCleanablePattern(dirName)) {
    return false;
  }

  // If state exists and status is 'running' or 'starting', don't clean
  if (state && (state.status === 'running' || state.status === 'starting')) {
    return false;
  }

  // Check age
  const dirPath = join(AGENTS_DIR, dirName);
  const ageDays = getAgentAgeDays(dirPath, state);

  return ageDays >= ageThresholdDays;
}

/**
 * Get list of old agent directories that can be cleaned
 */
export function getOldAgentDirs(ageThresholdDays: number): string[] {
  if (!existsSync(AGENTS_DIR)) {
    return [];
  }

  const allDirs = readdirSync(AGENTS_DIR);
  const cleanableDirs: string[] = [];

  for (const dirName of allDirs) {
    const dirPath = join(AGENTS_DIR, dirName);

    // Skip if not a directory
    try {
      const stats = statSync(dirPath);
      if (!stats.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    // Check if should be cleaned
    const state = getAgentState(dirName);
    if (shouldCleanAgent(dirName, state, ageThresholdDays)) {
      cleanableDirs.push(dirName);
    }
  }

  return cleanableDirs;
}

/**
 * Clean up old agent directories
 *
 * @param ageThresholdDays - Age threshold in days (default: from config or 7)
 * @param dryRun - If true, only report what would be deleted without actually deleting
 * @returns Cleanup result with list of deleted directories
 */
export async function cleanupOldAgents(
  ageThresholdDays?: number,
  dryRun: boolean = false
): Promise<CleanupResult> {
  const threshold = ageThresholdDays ?? getCleanupAgeThresholdDays();
  const toClean = getOldAgentDirs(threshold);

  const result: CleanupResult = {
    deleted: [],
    count: 0,
    dryRun,
    errors: [],
  };

  for (const dirName of toClean) {
    const dirPath = join(AGENTS_DIR, dirName);

    if (dryRun) {
      result.deleted.push(dirName);
      result.count++;
    } else {
      try {
        rmSync(dirPath, { recursive: true, force: true });
        result.deleted.push(dirName);
        result.count++;
      } catch (error) {
        result.errors.push({
          agent: dirName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return result;
}
