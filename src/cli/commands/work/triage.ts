import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

interface TriageOptions {
  create?: boolean;
  dismiss?: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  labels: { name: string }[];
  created_at: string;
  user: { login: string };
}

interface TriageState {
  dismissed: number[];
  created: { [githubNumber: number]: string }; // GitHub number -> Linear ID
}

function getConfig(): { githubToken?: string; githubRepo?: string; linearApiKey?: string } {
  const envFile = join(homedir(), '.panopticon.env');
  const config: { githubToken?: string; githubRepo?: string; linearApiKey?: string } = {};

  if (existsSync(envFile)) {
    const content = readFileSync(envFile, 'utf-8');

    const ghMatch = content.match(/GITHUB_TOKEN=(.+)/);
    if (ghMatch) config.githubToken = ghMatch[1].trim();

    const repoMatch = content.match(/GITHUB_REPO=(.+)/);
    if (repoMatch) config.githubRepo = repoMatch[1].trim();

    const linearMatch = content.match(/LINEAR_API_KEY=(.+)/);
    if (linearMatch) config.linearApiKey = linearMatch[1].trim();
  }

  // Also check environment
  config.githubToken = config.githubToken || process.env.GITHUB_TOKEN;
  config.githubRepo = config.githubRepo || process.env.GITHUB_REPO;
  config.linearApiKey = config.linearApiKey || process.env.LINEAR_API_KEY;

  return config;
}

function getTriageStatePath(): string {
  return join(homedir(), '.panopticon', 'triage-state.json');
}

function loadTriageState(): TriageState {
  const path = getTriageStatePath();
  if (existsSync(path)) {
    return JSON.parse(readFileSync(path, 'utf-8'));
  }
  return { dismissed: [], created: {} };
}

function saveTriageState(state: TriageState): void {
  const path = getTriageStatePath();
  writeFileSync(path, JSON.stringify(state, null, 2));
}

async function fetchGitHubIssues(token: string, repo: string): Promise<GitHubIssue[]> {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=50`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const issues = await response.json() as GitHubIssue[];
  // Filter out PRs (they also appear in /issues endpoint)
  return issues.filter(i => !('pull_request' in i));
}

async function createLinearIssue(
  apiKey: string,
  title: string,
  description: string,
  githubUrl: string
): Promise<string> {
  const { LinearClient } = await import('@linear/sdk');
  const client = new LinearClient({ apiKey });

  const me = await client.viewer;
  const teams = await me.teams();
  const team = teams.nodes[0];

  if (!team) {
    throw new Error('No Linear team found');
  }

  const fullDescription = `${description}\n\n---\n\n**From GitHub:** ${githubUrl}`;

  const result = await client.createIssue({
    teamId: team.id,
    title,
    description: fullDescription,
  });

  const issue = await result.issue;
  return issue?.identifier || 'unknown';
}

export async function triageCommand(id?: string, options: TriageOptions = {}): Promise<void> {
  const spinner = ora('Loading triage queue...').start();

  try {
    const config = getConfig();

    // Check for required config
    if (!config.githubToken || !config.githubRepo) {
      spinner.info('GitHub integration not configured');
      console.log('');
      console.log(chalk.bold('Setup Instructions:'));
      console.log('');
      console.log('Add to ~/.panopticon.env:');
      console.log(chalk.dim('  GITHUB_TOKEN=ghp_xxxxx'));
      console.log(chalk.dim('  GITHUB_REPO=owner/repo'));
      console.log('');
      console.log(chalk.dim('Get a token at: https://github.com/settings/tokens'));
      console.log(chalk.dim('Required scopes: repo (for private repos) or public_repo'));
      return;
    }

    const triageState = loadTriageState();

    // If specific ID provided, handle create/dismiss
    if (id) {
      const issueNumber = parseInt(id.replace('#', ''), 10);

      if (options.dismiss) {
        if (!triageState.dismissed.includes(issueNumber)) {
          triageState.dismissed.push(issueNumber);
          saveTriageState(triageState);
        }
        spinner.succeed(`Dismissed #${issueNumber}: ${options.dismiss}`);
        return;
      }

      if (options.create) {
        if (!config.linearApiKey) {
          spinner.fail('LINEAR_API_KEY not configured');
          return;
        }

        // Fetch the specific issue
        spinner.text = `Fetching GitHub issue #${issueNumber}...`;
        const response = await fetch(
          `https://api.github.com/repos/${config.githubRepo}/issues/${issueNumber}`,
          {
            headers: {
              Authorization: `Bearer ${config.githubToken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        if (!response.ok) {
          spinner.fail(`GitHub issue #${issueNumber} not found`);
          return;
        }

        const ghIssue = await response.json() as GitHubIssue;

        spinner.text = 'Creating Linear issue...';
        const linearId = await createLinearIssue(
          config.linearApiKey,
          ghIssue.title,
          ghIssue.body || '',
          ghIssue.html_url
        );

        triageState.created[issueNumber] = linearId;
        saveTriageState(triageState);

        spinner.succeed(`Created ${linearId} from GitHub #${issueNumber}`);
        console.log('');
        console.log(`  GitHub: ${chalk.dim(ghIssue.html_url)}`);
        console.log(`  Linear: ${chalk.cyan(linearId)}`);
        return;
      }
    }

    // List all GitHub issues needing triage
    spinner.text = 'Fetching GitHub issues...';
    const issues = await fetchGitHubIssues(config.githubToken, config.githubRepo);

    // Filter out dismissed and already created
    const pending = issues.filter(
      (i) => !triageState.dismissed.includes(i.number) && !triageState.created[i.number]
    );

    spinner.stop();

    if (pending.length === 0) {
      console.log(chalk.green('No issues pending triage.'));
      console.log(chalk.dim(`${issues.length} total open, ${triageState.dismissed.length} dismissed, ${Object.keys(triageState.created).length} created`));
      return;
    }

    console.log(chalk.bold(`\nGitHub Issues Pending Triage (${pending.length})\n`));

    for (const issue of pending) {
      const labels = issue.labels.map((l) => chalk.dim(`[${l.name}]`)).join(' ');
      console.log(`  ${chalk.cyan(`#${issue.number}`)} ${issue.title} ${labels}`);
      console.log(`    ${chalk.dim(issue.html_url)}`);
    }

    console.log('');
    console.log(chalk.bold('Commands:'));
    console.log(`  ${chalk.dim('Create Linear issue:')} pan work triage <number> --create`);
    console.log(`  ${chalk.dim('Dismiss from queue:')}  pan work triage <number> --dismiss "reason"`);
    console.log('');

  } catch (error: any) {
    spinner.fail(error.message);
    process.exit(1);
  }
}
