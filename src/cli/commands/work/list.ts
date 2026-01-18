import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface ListOptions {
  all?: boolean;
  mine?: boolean;
  json?: boolean;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  state: string;
  priority: number;
  assignee?: { name: string };
  url: string;
}

function getLinearApiKey(): string | null {
  // Check ~/.panopticon.env
  const envFile = join(homedir(), '.panopticon.env');
  if (existsSync(envFile)) {
    const content = readFileSync(envFile, 'utf-8');
    const match = content.match(/LINEAR_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  // Check environment
  return process.env.LINEAR_API_KEY || null;
}

const PRIORITY_LABELS: Record<number, string> = {
  0: chalk.dim('None'),
  1: chalk.red('Urgent'),
  2: chalk.yellow('High'),
  3: chalk.blue('Medium'),
  4: chalk.dim('Low'),
};

const STATE_COLORS: Record<string, (s: string) => string> = {
  'Backlog': chalk.dim,
  'Todo': chalk.white,
  'In Progress': chalk.yellow,
  'In Review': chalk.magenta,
  'Done': chalk.green,
  'Canceled': chalk.strikethrough,
};

export async function listCommand(options: ListOptions): Promise<void> {
  const spinner = ora('Fetching issues from Linear...').start();

  try {
    const apiKey = getLinearApiKey();
    if (!apiKey) {
      spinner.fail('LINEAR_API_KEY not found');
      console.log('');
      console.log(chalk.dim('Set it in ~/.panopticon.env:'));
      console.log('  LINEAR_API_KEY=lin_api_xxxxx');
      process.exit(1);
    }

    // Dynamic import to avoid loading if not needed
    const { LinearClient } = await import('@linear/sdk');
    const client = new LinearClient({ apiKey });

    // Get current user
    const me = await client.viewer;

    // Get teams
    const teams = await me.teams();
    const team = teams.nodes[0];

    if (!team) {
      spinner.fail('No Linear team found');
      process.exit(1);
    }

    spinner.text = `Fetching issues from ${team.name}...`;

    // Fetch issues
    let issues;
    if (options.mine) {
      const assignedIssues = await me.assignedIssues({
        first: 50,
        filter: options.all ? {} : { state: { type: { neq: 'completed' } } },
      });
      issues = assignedIssues.nodes;
    } else {
      const teamIssues = await team.issues({
        first: 50,
        filter: options.all ? {} : { state: { type: { neq: 'completed' } } },
      });
      issues = teamIssues.nodes;
    }

    spinner.stop();

    if (options.json) {
      const formatted = await Promise.all(issues.map(async (issue) => {
        const state = await issue.state;
        const assignee = await issue.assignee;
        return {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          state: state?.name,
          priority: issue.priority,
          assignee: assignee?.name,
          url: issue.url,
        };
      }));
      console.log(JSON.stringify(formatted, null, 2));
      return;
    }

    if (issues.length === 0) {
      console.log(chalk.dim('No issues found.'));
      return;
    }

    console.log(chalk.bold(`\n${team.name} Issues\n`));

    // Group by state
    const byState: Record<string, typeof issues> = {};
    for (const issue of issues) {
      const state = await issue.state;
      const stateName = state?.name || 'Unknown';
      if (!byState[stateName]) byState[stateName] = [];
      byState[stateName].push(issue);
    }

    // Display order
    const stateOrder = ['In Progress', 'In Review', 'Todo', 'Backlog', 'Done', 'Canceled'];

    for (const stateName of stateOrder) {
      const stateIssues = byState[stateName];
      if (!stateIssues || stateIssues.length === 0) continue;

      const colorFn = STATE_COLORS[stateName] || chalk.white;
      console.log(colorFn(`── ${stateName} (${stateIssues.length}) ──`));
      console.log('');

      for (const issue of stateIssues) {
        const assignee = await issue.assignee;
        const priorityLabel = PRIORITY_LABELS[issue.priority] || '';
        const assigneeStr = assignee ? chalk.dim(` @${assignee.name.split(' ')[0]}`) : '';

        console.log(`  ${chalk.cyan(issue.identifier)} ${issue.title}${assigneeStr}`);
        if (issue.priority > 0 && issue.priority < 3) {
          console.log(`    ${priorityLabel}`);
        }
      }
      console.log('');
    }

    console.log(chalk.dim(`Showing ${issues.length} issues. Use --all to include completed.`));

  } catch (error: any) {
    spinner.fail(error.message);
    process.exit(1);
  }
}
