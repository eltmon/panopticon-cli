import chalk from 'chalk';
import ora from 'ora';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { spawnAgent } from '../../../lib/agents.js';

interface IssueOptions {
  model: string;
  runtime: string;
  dryRun?: boolean;
}

/**
 * Find the workspace directory for an issue.
 * Looks for workspaces/feature-{issue-id}/ in the project root.
 */
function findWorkspace(issueId: string): string | null {
  const normalizedId = issueId.toLowerCase();

  // Search upward for a project root (has .git or workspaces/)
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const workspacesDir = join(dir, 'workspaces');
    if (existsSync(workspacesDir)) {
      // Look for feature-{issue-id} workspace
      const workspaceName = `feature-${normalizedId}`;
      const workspacePath = join(workspacesDir, workspaceName);
      if (existsSync(workspacePath)) {
        return workspacePath;
      }

      // Also try without "feature-" prefix
      const altPath = join(workspacesDir, normalizedId);
      if (existsSync(altPath)) {
        return altPath;
      }
    }

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Find the project root (contains workspaces/, .git, or CLAUDE.md)
 */
function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, 'workspaces')) ||
        existsSync(join(dir, '.git')) ||
        existsSync(join(dir, 'CLAUDE.md'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * Read planning artifacts for an issue (STATE.md, etc.)
 */
function readPlanningContext(workspacePath: string): string | null {
  const statePath = join(workspacePath, '.planning', 'STATE.md');
  if (existsSync(statePath)) {
    return readFileSync(statePath, 'utf-8');
  }
  return null;
}

/**
 * Extract beads IDs from STATE.md content
 * Looks for patterns like `panopticon-1dg` in backticks or tables
 */
function extractBeadsIdsFromState(stateContent: string): string[] {
  const ids: string[] = [];

  // Match beads IDs in backticks (e.g., `panopticon-1dg`)
  const backtickMatches = stateContent.match(/`([a-z]+-[a-z0-9]+)`/g) || [];
  for (const match of backtickMatches) {
    const id = match.replace(/`/g, '');
    // Filter for valid beads IDs (project-xxx format)
    if (id.match(/^[a-z]+-[a-z0-9]{2,4}$/)) {
      ids.push(id);
    }
  }

  return [...new Set(ids)]; // Deduplicate
}

/**
 * Read beads tasks for an issue from both workspace and project root.
 * Uses STATE.md to find the associated beads IDs.
 */
function readBeadsTasks(workspacePath: string, projectRoot: string, issueId: string): string[] {
  const tasks: string[] = [];
  const normalizedId = issueId.toLowerCase();

  // First, extract beads IDs from STATE.md
  const stateContent = readPlanningContext(workspacePath);
  const beadsIds = stateContent ? extractBeadsIdsFromState(stateContent) : [];

  // Check both locations for beads database
  const beadsPaths = [
    join(workspacePath, '.beads', 'issues.jsonl'),
    join(projectRoot, '.beads', 'issues.jsonl'),
  ];

  const seenIds = new Set<string>();

  for (const beadsPath of beadsPaths) {
    if (!existsSync(beadsPath)) continue;

    try {
      const content = readFileSync(beadsPath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const task = JSON.parse(line);
          if (seenIds.has(task.id)) continue;

          // Match by:
          // 1. Task ID is in the STATE.md beads list
          // 2. Task is tagged with the issue ID
          // 3. Task title contains the issue ID
          const tags = task.tags || [];
          const isMatch =
            beadsIds.includes(task.id) ||
            tags.some((t: string) => t.toLowerCase().includes(normalizedId)) ||
            task.title?.toLowerCase().includes(normalizedId);

          if (isMatch) {
            seenIds.add(task.id);
            tasks.push(`- [${task.status || 'open'}] ${task.title} (${task.id})`);
          }
        } catch {}
      }
    } catch {}
  }

  return tasks;
}

/**
 * Build a comprehensive prompt with planning context
 */
function buildAgentPrompt(issueId: string, workspacePath: string, projectRoot: string): string {
  const lines: string[] = [
    `# Working on Issue: ${issueId}`,
    '',
    `**Workspace:** ${workspacePath}`,
    '',
  ];

  // Add planning context if available
  const planningContext = readPlanningContext(workspacePath);
  if (planningContext) {
    lines.push('## Planning Context');
    lines.push('');
    lines.push('The following planning was done for this issue:');
    lines.push('');
    lines.push('```markdown');
    // Truncate if too long
    const truncated = planningContext.length > 3000
      ? planningContext.slice(0, 3000) + '\n\n... (truncated, see .planning/STATE.md for full context)'
      : planningContext;
    lines.push(truncated);
    lines.push('```');
    lines.push('');
  }

  // Add beads tasks
  const beadsTasks = readBeadsTasks(workspacePath, projectRoot, issueId);
  if (beadsTasks.length > 0) {
    lines.push('## Beads Tasks');
    lines.push('');
    lines.push('Tasks created during planning:');
    lines.push('');
    lines.push(beadsTasks.join('\n'));
    lines.push('');
    lines.push('Use `bd show <task-id>` to see task details, `bd update <task-id> --status in_progress` to start work.');
    lines.push('');
  }

  // Add workspace CLAUDE.md if it exists
  const claudeMdPath = join(workspacePath, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    lines.push('## Workspace Instructions');
    lines.push('');
    lines.push('See CLAUDE.md in workspace for additional context and warnings.');
    lines.push('');
  }

  lines.push('## Your Task');
  lines.push('');
  lines.push('Implement the planned work for this issue. Follow the planning context above.');
  lines.push('Mark beads tasks as complete as you finish them: `bd update <task-id> --status closed`');
  lines.push('');

  return lines.join('\n');
}

export async function issueCommand(id: string, options: IssueOptions): Promise<void> {
  const spinner = ora(`Preparing workspace for ${id}...`).start();

  try {
    // Normalize issue ID (MIN-648 -> min-648 for tmux session name)
    const normalizedId = id.toLowerCase();

    // Find workspace for this issue
    const projectRoot = findProjectRoot();
    let workspace = findWorkspace(id);

    if (!workspace) {
      spinner.warn(`No workspace found for ${id}, using project root`);
      workspace = projectRoot;
    } else {
      spinner.text = `Found workspace: ${workspace}`;
    }

    if (options.dryRun) {
      spinner.info('Dry run mode');
      console.log('');
      console.log(chalk.bold('Would create:'));
      console.log(`  Agent ID:   agent-${normalizedId}`);
      console.log(`  Workspace:  ${workspace}`);
      console.log(`  Runtime:    ${options.runtime}`);
      console.log(`  Model:      ${options.model}`);

      // Show what context would be included
      const planningContext = readPlanningContext(workspace);
      const beadsTasks = readBeadsTasks(workspace, projectRoot, id);
      console.log('');
      console.log(chalk.bold('Context:'));
      console.log(`  Planning:   ${planningContext ? 'Found (.planning/STATE.md)' : 'None'}`);
      console.log(`  Beads:      ${beadsTasks.length} tasks`);
      return;
    }

    spinner.text = 'Building agent prompt with planning context...';
    const prompt = buildAgentPrompt(id, workspace, projectRoot);

    spinner.text = 'Spawning agent...';

    const agent = spawnAgent({
      issueId: id,
      workspace,
      runtime: options.runtime,
      model: options.model,
      prompt,
    });

    spinner.succeed(`Agent spawned: ${agent.id}`);

    console.log('');
    console.log(chalk.bold('Agent Details:'));
    console.log(`  Session:    ${chalk.cyan(agent.id)}`);
    console.log(`  Workspace:  ${workspace}`);
    console.log(`  Runtime:    ${agent.runtime} (${agent.model})`);

    // Show context info
    const planningContext = readPlanningContext(workspace);
    const beadsTasks = readBeadsTasks(workspace, projectRoot, id);
    if (planningContext || beadsTasks.length > 0) {
      console.log('');
      console.log(chalk.bold('Context Loaded:'));
      if (planningContext) console.log(`  Planning:   ${chalk.green('✓')} STATE.md`);
      if (beadsTasks.length > 0) console.log(`  Beads:      ${chalk.green('✓')} ${beadsTasks.length} tasks`);
    }

    console.log('');
    console.log(chalk.dim('Commands:'));
    console.log(`  Attach:   tmux attach -t ${agent.id}`);
    console.log(`  Message:  pan work tell ${id} "your message"`);
    console.log(`  Kill:     pan work kill ${id}`);

  } catch (error: any) {
    spinner.fail(error.message);
    process.exit(1);
  }
}
