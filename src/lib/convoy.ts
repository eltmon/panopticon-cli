/**
 * Convoy System
 *
 * Parallel agent execution for multi-issue work.
 * A convoy is a group of agents working on related issues simultaneously.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { AGENTS_DIR } from './paths.js';
import type { RuntimeType } from './runtime/interface.js';

// ============== Types ==============

export type ConvoyStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type AgentRole = 'leader' | 'worker' | 'reviewer';

export interface ConvoyAgent {
  id: string;
  issueId: string;
  role: AgentRole;
  status: ConvoyStatus;
  runtime: RuntimeType;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  dependencies?: string[]; // IDs of agents this agent depends on
  artifacts?: string[]; // Files/outputs produced
}

export interface ConvoyManifest {
  id: string;
  name: string;
  description?: string;
  status: ConvoyStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  agents: ConvoyAgent[];
  config: ConvoyConfig;
  results?: ConvoyResults;
}

export interface ConvoyConfig {
  maxParallel: number;
  runtime: RuntimeType;
  model?: string;
  timeout?: number;
  stopOnError: boolean;
  synthesize: boolean;
  projectDir?: string;
}

export interface ConvoyResults {
  totalAgents: number;
  completed: number;
  failed: number;
  cancelled: number;
  duration: number;
  artifacts: string[];
  summary?: string;
}

export interface ConvoyEvent {
  timestamp: string;
  type: 'started' | 'agent_started' | 'agent_completed' | 'agent_failed' | 'completed' | 'failed';
  agentId?: string;
  message: string;
  data?: Record<string, any>;
}

// ============== Convoy Management ==============

function getConvoyDir(): string {
  return join(AGENTS_DIR, 'convoys');
}

function getConvoyFile(convoyId: string): string {
  return join(getConvoyDir(), `${convoyId}.json`);
}

function getConvoyEventsFile(convoyId: string): string {
  return join(getConvoyDir(), `${convoyId}.events.jsonl`);
}

/**
 * Create a new convoy
 */
export function createConvoy(
  name: string,
  issueIds: string[],
  config: Partial<ConvoyConfig> = {}
): ConvoyManifest {
  const convoyDir = getConvoyDir();
  mkdirSync(convoyDir, { recursive: true });

  const convoyId = `convoy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const fullConfig: ConvoyConfig = {
    maxParallel: 3,
    runtime: 'claude',
    stopOnError: false,
    synthesize: true,
    ...config,
  };

  const agents: ConvoyAgent[] = issueIds.map((issueId, index) => ({
    id: `${convoyId}-agent-${index}`,
    issueId,
    role: index === 0 ? 'leader' : 'worker',
    status: 'pending',
    runtime: fullConfig.runtime,
  }));

  const manifest: ConvoyManifest = {
    id: convoyId,
    name,
    status: 'pending',
    createdAt: new Date().toISOString(),
    agents,
    config: fullConfig,
  };

  writeFileSync(getConvoyFile(convoyId), JSON.stringify(manifest, null, 2));

  return manifest;
}

/**
 * Get a convoy by ID
 */
export function getConvoy(convoyId: string): ConvoyManifest | null {
  const convoyFile = getConvoyFile(convoyId);
  if (!existsSync(convoyFile)) {
    return null;
  }

  try {
    const content = readFileSync(convoyFile, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Update convoy manifest
 */
export function updateConvoy(manifest: ConvoyManifest): void {
  writeFileSync(getConvoyFile(manifest.id), JSON.stringify(manifest, null, 2));
}

/**
 * Log a convoy event
 */
export function logConvoyEvent(convoyId: string, event: Omit<ConvoyEvent, 'timestamp'>): void {
  const eventsFile = getConvoyEventsFile(convoyId);
  const fullEvent: ConvoyEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  const line = JSON.stringify(fullEvent) + '\n';

  if (existsSync(eventsFile)) {
    writeFileSync(eventsFile, readFileSync(eventsFile, 'utf-8') + line);
  } else {
    writeFileSync(eventsFile, line);
  }
}

/**
 * Get convoy events
 */
export function getConvoyEvents(convoyId: string): ConvoyEvent[] {
  const eventsFile = getConvoyEventsFile(convoyId);
  if (!existsSync(eventsFile)) {
    return [];
  }

  const content = readFileSync(eventsFile, 'utf-8');
  return content
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ConvoyEvent[];
}

// ============== Convoy Orchestration ==============

/**
 * Get agents ready to run (no pending dependencies)
 */
export function getReadyAgents(manifest: ConvoyManifest): ConvoyAgent[] {
  return manifest.agents.filter(agent => {
    if (agent.status !== 'pending') return false;

    // Check dependencies
    if (agent.dependencies && agent.dependencies.length > 0) {
      for (const depId of agent.dependencies) {
        const dep = manifest.agents.find(a => a.id === depId);
        if (!dep || dep.status !== 'completed') {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Get running agents count
 */
export function getRunningCount(manifest: ConvoyManifest): number {
  return manifest.agents.filter(a => a.status === 'running').length;
}

/**
 * Get agents that can be started
 */
export function getAgentsToStart(manifest: ConvoyManifest): ConvoyAgent[] {
  const runningCount = getRunningCount(manifest);
  const available = manifest.config.maxParallel - runningCount;

  if (available <= 0) return [];

  const ready = getReadyAgents(manifest);
  return ready.slice(0, available);
}

/**
 * Update agent status
 */
export function updateAgentStatus(
  manifest: ConvoyManifest,
  agentId: string,
  status: ConvoyStatus,
  error?: string
): ConvoyManifest {
  const agent = manifest.agents.find(a => a.id === agentId);
  if (!agent) return manifest;

  agent.status = status;

  if (status === 'running' && !agent.startedAt) {
    agent.startedAt = new Date().toISOString();
  }

  if (status === 'completed' || status === 'failed') {
    agent.completedAt = new Date().toISOString();
  }

  if (error) {
    agent.error = error;
  }

  // Update convoy status based on agents
  updateConvoyStatus(manifest);

  return manifest;
}

/**
 * Update convoy status based on agent states
 */
function updateConvoyStatus(manifest: ConvoyManifest): void {
  const agents = manifest.agents;
  const hasRunning = agents.some(a => a.status === 'running');
  const hasPending = agents.some(a => a.status === 'pending');
  const hasFailed = agents.some(a => a.status === 'failed');
  const allComplete = agents.every(a => a.status === 'completed' || a.status === 'cancelled');

  if (allComplete) {
    manifest.status = 'completed';
    manifest.completedAt = new Date().toISOString();
  } else if (hasFailed && manifest.config.stopOnError && !hasRunning) {
    manifest.status = 'failed';
    manifest.completedAt = new Date().toISOString();
  } else if (hasRunning) {
    manifest.status = 'running';
  } else if (hasPending && !hasRunning && hasFailed && manifest.config.stopOnError) {
    // Stopped due to error
    manifest.status = 'failed';
  }
}

/**
 * Calculate convoy results
 */
export function calculateResults(manifest: ConvoyManifest): ConvoyResults {
  const agents = manifest.agents;

  const results: ConvoyResults = {
    totalAgents: agents.length,
    completed: agents.filter(a => a.status === 'completed').length,
    failed: agents.filter(a => a.status === 'failed').length,
    cancelled: agents.filter(a => a.status === 'cancelled').length,
    duration: 0,
    artifacts: [],
  };

  if (manifest.startedAt && manifest.completedAt) {
    results.duration =
      new Date(manifest.completedAt).getTime() -
      new Date(manifest.startedAt).getTime();
  }

  // Collect artifacts from all agents
  for (const agent of agents) {
    if (agent.artifacts) {
      results.artifacts.push(...agent.artifacts);
    }
  }

  return results;
}

// ============== Convoy Execution ==============

/**
 * Start a convoy
 */
export async function startConvoy(convoyId: string): Promise<boolean> {
  const manifest = getConvoy(convoyId);
  if (!manifest) {
    console.error(`Convoy not found: ${convoyId}`);
    return false;
  }

  if (manifest.status !== 'pending') {
    console.error(`Convoy is not in pending state: ${manifest.status}`);
    return false;
  }

  manifest.status = 'running';
  manifest.startedAt = new Date().toISOString();
  updateConvoy(manifest);

  logConvoyEvent(convoyId, {
    type: 'started',
    message: `Convoy started with ${manifest.agents.length} agents`,
  });

  // Start initial batch of agents
  await runConvoyLoop(convoyId);

  return true;
}

/**
 * Run the convoy execution loop
 */
async function runConvoyLoop(convoyId: string): Promise<void> {
  let manifest = getConvoy(convoyId);
  if (!manifest || manifest.status !== 'running') return;

  while (manifest.status === 'running') {
    const toStart = getAgentsToStart(manifest);

    // Start new agents
    for (const agent of toStart) {
      const started = await startConvoyAgent(manifest, agent);
      if (started) {
        agent.status = 'running';
        agent.startedAt = new Date().toISOString();

        logConvoyEvent(convoyId, {
          type: 'agent_started',
          agentId: agent.id,
          message: `Agent started for issue ${agent.issueId}`,
        });
      }
    }

    updateConvoy(manifest);

    // Check if convoy is complete
    const runningCount = getRunningCount(manifest);
    const pendingCount = manifest.agents.filter(a => a.status === 'pending').length;

    if (runningCount === 0 && pendingCount === 0) {
      // Convoy complete
      break;
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Refresh manifest
    manifest = getConvoy(convoyId);
    if (!manifest) break;
  }

  // Finalize convoy
  if (manifest) {
    manifest.results = calculateResults(manifest);
    updateConvoy(manifest);

    logConvoyEvent(convoyId, {
      type: manifest.status === 'completed' ? 'completed' : 'failed',
      message: `Convoy ${manifest.status}: ${manifest.results.completed}/${manifest.results.totalAgents} agents completed`,
    });
  }
}

/**
 * Start an individual convoy agent
 */
async function startConvoyAgent(
  manifest: ConvoyManifest,
  agent: ConvoyAgent
): Promise<boolean> {
  try {
    const { execa } = await import('execa');

    // Build the command based on runtime
    const sessionName = agent.id;

    // Spawn agent in tmux
    const workDir = manifest.config.projectDir || process.cwd();
    const prompt = `Work on issue ${agent.issueId}. You are part of convoy ${manifest.name}.`;

    const claudeCmd = `cd "${workDir}" && claude --print`;

    await execa('tmux', [
      'new-session',
      '-d',
      '-s', sessionName,
      'bash', '-c', claudeCmd,
    ]);

    // Wait then send prompt
    await new Promise(resolve => setTimeout(resolve, 1000));

    await execa('tmux', ['send-keys', '-t', sessionName, prompt]);
    await execa('tmux', ['send-keys', '-t', sessionName, 'Enter']);

    return true;
  } catch (error) {
    console.error(`Failed to start convoy agent ${agent.id}:`, error);
    return false;
  }
}

/**
 * Stop a convoy
 */
export async function stopConvoy(convoyId: string): Promise<boolean> {
  const manifest = getConvoy(convoyId);
  if (!manifest) return false;

  const { execa } = await import('execa');

  // Stop all running agents
  for (const agent of manifest.agents) {
    if (agent.status === 'running') {
      try {
        await execa('tmux', ['kill-session', '-t', agent.id]);
        agent.status = 'cancelled';
        agent.completedAt = new Date().toISOString();
      } catch {
        // Session might not exist
      }
    } else if (agent.status === 'pending') {
      agent.status = 'cancelled';
    }
  }

  manifest.status = 'cancelled';
  manifest.completedAt = new Date().toISOString();
  manifest.results = calculateResults(manifest);

  updateConvoy(manifest);

  logConvoyEvent(convoyId, {
    type: 'failed',
    message: 'Convoy cancelled by user',
  });

  return true;
}

/**
 * Pause a convoy (stop starting new agents)
 */
export function pauseConvoy(convoyId: string): boolean {
  const manifest = getConvoy(convoyId);
  if (!manifest || manifest.status !== 'running') return false;

  manifest.status = 'paused';
  updateConvoy(manifest);

  return true;
}

/**
 * Resume a paused convoy
 */
export async function resumeConvoy(convoyId: string): Promise<boolean> {
  const manifest = getConvoy(convoyId);
  if (!manifest || manifest.status !== 'paused') return false;

  manifest.status = 'running';
  updateConvoy(manifest);

  // Continue the loop
  await runConvoyLoop(convoyId);

  return true;
}

// ============== Convoy Synthesis ==============

/**
 * Generate synthesis prompt for combining agent outputs
 */
export function generateSynthesisPrompt(manifest: ConvoyManifest): string {
  const completedAgents = manifest.agents.filter(a => a.status === 'completed');

  const lines: string[] = [
    `# Convoy Synthesis: ${manifest.name}`,
    '',
    `**Convoy ID:** ${manifest.id}`,
    `**Completed Agents:** ${completedAgents.length}/${manifest.agents.length}`,
    '',
    '## Agent Work Summary',
    '',
  ];

  for (const agent of completedAgents) {
    lines.push(`### ${agent.issueId} (${agent.role})`);
    lines.push(`- Agent ID: ${agent.id}`);
    lines.push(`- Duration: ${calculateDuration(agent)}`);
    if (agent.artifacts && agent.artifacts.length > 0) {
      lines.push(`- Artifacts:`);
      for (const artifact of agent.artifacts) {
        lines.push(`  - ${artifact}`);
      }
    }
    lines.push('');
  }

  lines.push('## Synthesis Task');
  lines.push('');
  lines.push('Please review the work completed by all agents and:');
  lines.push('1. Ensure consistency across all changes');
  lines.push('2. Resolve any conflicts or overlaps');
  lines.push('3. Run integration tests');
  lines.push('4. Create a combined summary');
  lines.push('');

  return lines.join('\n');
}

function calculateDuration(agent: ConvoyAgent): string {
  if (!agent.startedAt || !agent.completedAt) return 'N/A';

  const duration =
    new Date(agent.completedAt).getTime() -
    new Date(agent.startedAt).getTime();

  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  return `${minutes}m ${seconds}s`;
}

// ============== Convoy Queries ==============

/**
 * List all convoys
 */
export function listConvoys(): ConvoyManifest[] {
  const convoyDir = getConvoyDir();
  if (!existsSync(convoyDir)) return [];

  const { readdirSync } = require('fs');
  const files = readdirSync(convoyDir).filter(
    (f: string) => f.endsWith('.json') && !f.endsWith('.events.json')
  );

  return files
    .map((f: string) => {
      try {
        const content = readFileSync(join(convoyDir, f), 'utf-8');
        return JSON.parse(content);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ConvoyManifest[];
}

/**
 * Get active (running or paused) convoys
 */
export function getActiveConvoys(): ConvoyManifest[] {
  return listConvoys().filter(
    c => c.status === 'running' || c.status === 'paused'
  );
}

/**
 * Get convoy by name
 */
export function getConvoyByName(name: string): ConvoyManifest | null {
  return listConvoys().find(c => c.name === name) || null;
}

/**
 * Delete a convoy
 */
export function deleteConvoy(convoyId: string): boolean {
  const convoyFile = getConvoyFile(convoyId);
  const eventsFile = getConvoyEventsFile(convoyId);

  if (!existsSync(convoyFile)) {
    return false;
  }

  try {
    unlinkSync(convoyFile);
    if (existsSync(eventsFile)) {
      unlinkSync(eventsFile);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get convoy status summary
 */
export function getConvoyStatus(convoyId: string): {
  status: ConvoyStatus;
  totalAgents: number;
  pendingCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  progress: number;
} | null {
  const manifest = getConvoy(convoyId);
  if (!manifest) return null;

  const totalAgents = manifest.agents.length;
  const pendingCount = manifest.agents.filter(a => a.status === 'pending').length;
  const runningCount = manifest.agents.filter(a => a.status === 'running').length;
  const completedCount = manifest.agents.filter(a => a.status === 'completed').length;
  const failedCount = manifest.agents.filter(a => a.status === 'failed').length;
  const progress = totalAgents > 0 ? completedCount / totalAgents : 0;

  return {
    status: manifest.status,
    totalAgents,
    pendingCount,
    runningCount,
    completedCount,
    failedCount,
    progress,
  };
}
