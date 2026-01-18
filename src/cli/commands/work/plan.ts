import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

interface PlanOptions {
  output?: string;
  json?: boolean;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  state: { name: string };
  priority: number;
  url: string;
  labels?: { name: string }[];
  assignee?: { name: string };
  project?: { name: string };
}

function getLinearApiKey(): string | null {
  const envFile = join(homedir(), '.panopticon.env');
  if (existsSync(envFile)) {
    const content = readFileSync(envFile, 'utf-8');
    const match = content.match(/LINEAR_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  return process.env.LINEAR_API_KEY || null;
}

function findPRDFiles(issueId: string): string[] {
  const found: string[] = [];
  const cwd = process.cwd();

  // Common PRD locations
  const searchPaths = [
    'docs/prds',
    'docs/prd',
    'prds',
    'docs',
  ];

  const issueIdLower = issueId.toLowerCase();

  for (const searchPath of searchPaths) {
    const fullPath = join(cwd, searchPath);
    if (!existsSync(fullPath)) continue;

    try {
      // Use find to search for files containing the issue ID
      const result = execSync(
        `find "${fullPath}" -type f -name "*.md" 2>/dev/null | xargs grep -l -i "${issueIdLower}" 2>/dev/null || true`,
        { encoding: 'utf-8' }
      );

      const files = result.trim().split('\n').filter(f => f);
      found.push(...files);
    } catch {
      // Ignore search errors
    }
  }

  return [...new Set(found)];
}

function generatePlan(issue: LinearIssue, prdFiles: string[]): string {
  const sections: string[] = [];

  // Header
  sections.push(`# Execution Plan: ${issue.identifier}`);
  sections.push('');
  sections.push(`**Title:** ${issue.title}`);
  sections.push(`**Status:** ${issue.state.name}`);
  if (issue.project) {
    sections.push(`**Project:** ${issue.project.name}`);
  }
  sections.push(`**Linear:** ${issue.url}`);
  sections.push('');

  // Description
  if (issue.description) {
    sections.push('## Issue Description');
    sections.push('');
    sections.push(issue.description);
    sections.push('');
  }

  // PRD References
  if (prdFiles.length > 0) {
    sections.push('## Related PRDs');
    sections.push('');
    for (const prd of prdFiles) {
      sections.push(`- [${prd.replace(process.cwd() + '/', '')}](${prd})`);
    }
    sections.push('');
    sections.push('> **IMPORTANT:** Review the PRD before starting implementation.');
    sections.push('');
  }

  // Implementation checklist (template)
  sections.push('## Implementation Steps');
  sections.push('');
  sections.push('<!-- Edit these steps based on the issue requirements -->');
  sections.push('');
  sections.push('- [ ] Understand requirements and existing code');
  sections.push('- [ ] Design approach (document in comments if complex)');
  sections.push('- [ ] Implement core functionality');
  sections.push('- [ ] Add tests');
  sections.push('- [ ] Verify linting/type checks pass');
  sections.push('- [ ] Manual testing');
  sections.push('- [ ] Update documentation if needed');
  sections.push('');

  // Files to modify (placeholder)
  sections.push('## Files to Modify');
  sections.push('');
  sections.push('<!-- List files that will need changes -->');
  sections.push('');
  sections.push('- TBD after codebase exploration');
  sections.push('');

  // Test strategy
  sections.push('## Test Strategy');
  sections.push('');
  sections.push('<!-- Define how this will be tested -->');
  sections.push('');
  sections.push('- Unit tests: TBD');
  sections.push('- Integration tests: TBD');
  sections.push('- E2E tests: TBD');
  sections.push('');

  // Acceptance criteria
  sections.push('## Acceptance Criteria');
  sections.push('');
  sections.push('<!-- What must be true for this to be complete? -->');
  sections.push('');
  sections.push('- [ ] Feature works as described');
  sections.push('- [ ] Tests pass');
  sections.push('- [ ] No regressions');
  sections.push('');

  // Notes for agent
  sections.push('## Notes for Agent');
  sections.push('');
  sections.push('<!-- Add any special instructions or context -->');
  sections.push('');
  sections.push('- Review this plan before starting');
  sections.push('- Ask clarifying questions if requirements are unclear');
  sections.push('- Commit frequently with descriptive messages');
  sections.push('');

  return sections.join('\n');
}

export async function planCommand(id: string, options: PlanOptions = {}): Promise<void> {
  const spinner = ora(`Creating execution plan for ${id}...`).start();

  try {
    const apiKey = getLinearApiKey();
    if (!apiKey) {
      spinner.fail('LINEAR_API_KEY not found');
      console.log('');
      console.log(chalk.dim('Set it in ~/.panopticon.env:'));
      console.log('  LINEAR_API_KEY=lin_api_xxxxx');
      process.exit(1);
    }

    // Fetch issue from Linear
    spinner.text = 'Fetching issue from Linear...';
    const { LinearClient } = await import('@linear/sdk');
    const client = new LinearClient({ apiKey });

    // Get the current user's teams to search within
    const me = await client.viewer;
    const teams = await me.teams();
    const team = teams.nodes[0];

    if (!team) {
      spinner.fail('No Linear team found');
      process.exit(1);
    }

    // Fetch recent issues and find by identifier
    const searchResult = await team.issues({
      first: 100,
    });

    // Find exact match by identifier
    const issue = searchResult.nodes.find(
      (i) => i.identifier.toUpperCase() === id.toUpperCase()
    );

    if (!issue) {
      spinner.fail(`Issue not found: ${id}`);
      process.exit(1);
    }

    // Get full issue details
    const state = await issue.state;
    const assignee = await issue.assignee;
    const project = await issue.project;
    const labels = await issue.labels();

    const issueData: LinearIssue = {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description || undefined,
      state: { name: state?.name || 'Unknown' },
      priority: issue.priority,
      url: issue.url,
      labels: labels.nodes.map(l => ({ name: l.name })),
      assignee: assignee ? { name: assignee.name } : undefined,
      project: project ? { name: project.name } : undefined,
    };

    // Look for related PRD files
    spinner.text = 'Searching for related PRDs...';
    const prdFiles = findPRDFiles(id);

    // Generate plan
    spinner.text = 'Generating execution plan...';
    const plan = generatePlan(issueData, prdFiles);

    if (options.json) {
      spinner.stop();
      console.log(JSON.stringify({
        issue: issueData,
        prdFiles,
        plan,
      }, null, 2));
      return;
    }

    // Determine output path
    const outputPath = options.output || `PLAN-${issue.identifier}.md`;

    // Write plan file
    writeFileSync(outputPath, plan);

    spinner.succeed(`Execution plan created: ${outputPath}`);
    console.log('');

    // Show summary
    console.log(chalk.bold('Issue Details:'));
    console.log(`  ${chalk.cyan(issue.identifier)} ${issue.title}`);
    console.log(`  Status: ${state?.name}`);
    if (prdFiles.length > 0) {
      console.log(`  PRDs found: ${chalk.green(prdFiles.length)}`);
    }
    console.log('');

    console.log(chalk.bold('Next steps:'));
    console.log(`  1. Review and edit ${chalk.cyan(outputPath)}`);
    console.log(`  2. Run ${chalk.cyan(`pan work issue ${id}`)} to spawn agent`);
    console.log('');

    if (prdFiles.length > 0) {
      console.log(chalk.yellow('PRD files found - agent will reference these:'));
      for (const prd of prdFiles) {
        console.log(`  ${chalk.dim(prd.replace(process.cwd() + '/', ''))}`);
      }
      console.log('');
    }

  } catch (error: any) {
    spinner.fail(error.message);
    process.exit(1);
  }
}
