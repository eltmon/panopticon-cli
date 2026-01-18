import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { createWorktree, removeWorktree, listWorktrees } from '../../lib/worktree.js';
import { generateClaudeMd, TemplateVariables } from '../../lib/template.js';
import { mergeSkillsIntoWorkspace } from '../../lib/skills-merge.js';

export function registerWorkspaceCommands(program: Command): void {
  const workspace = program.command('workspace').description('Workspace management');

  workspace
    .command('create <issueId>')
    .description('Create workspace for issue')
    .option('--dry-run', 'Show what would be created')
    .option('--no-skills', 'Skip skills symlink setup')
    .action(createCommand);

  workspace
    .command('list')
    .description('List all workspaces')
    .option('--json', 'Output as JSON')
    .action(listCommand);

  workspace
    .command('destroy <issueId>')
    .description('Destroy workspace')
    .option('--force', 'Force removal even with uncommitted changes')
    .action(destroyCommand);
}

interface CreateOptions {
  dryRun?: boolean;
  skills?: boolean;
}

async function createCommand(issueId: string, options: CreateOptions): Promise<void> {
  const spinner = ora('Creating workspace...').start();

  try {
    // Normalize issue ID (e.g., MIN-123 -> min-123)
    const normalizedId = issueId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const branchName = `feature/${normalizedId}`;
    const folderName = `feature-${normalizedId}`;

    // Determine paths
    const projectRoot = process.cwd();
    const workspacesDir = join(projectRoot, 'workspaces');
    const workspacePath = join(workspacesDir, folderName);

    if (options.dryRun) {
      spinner.info('Dry run mode');
      console.log('');
      console.log(chalk.bold('Would create:'));
      console.log(`  Workspace: ${chalk.cyan(workspacePath)}`);
      console.log(`  Branch:    ${chalk.cyan(branchName)}`);
      console.log(`  CLAUDE.md: ${chalk.dim(join(workspacePath, 'CLAUDE.md'))}`);
      if (options.skills !== false) {
        console.log(`  Skills:    ${chalk.dim(join(workspacePath, '.claude', 'skills'))}`);
      }
      return;
    }

    // Check if already exists
    if (existsSync(workspacePath)) {
      spinner.fail(`Workspace already exists: ${workspacePath}`);
      process.exit(1);
    }

    // Check if we're in a git repo
    if (!existsSync(join(projectRoot, '.git'))) {
      spinner.fail('Not a git repository. Run this from the project root.');
      process.exit(1);
    }

    // Create worktree
    spinner.text = 'Creating git worktree...';
    createWorktree(projectRoot, workspacePath, branchName);

    // Generate CLAUDE.md
    spinner.text = 'Generating CLAUDE.md...';
    const variables: TemplateVariables = {
      FEATURE_FOLDER: folderName,
      BRANCH_NAME: branchName,
      ISSUE_ID: issueId.toUpperCase(),
      WORKSPACE_PATH: workspacePath,
      FRONTEND_URL: `https://${folderName}.localhost:3000`,
      API_URL: `https://api-${folderName}.localhost:8080`,
    };

    const claudeMd = generateClaudeMd(projectRoot, variables);
    writeFileSync(join(workspacePath, 'CLAUDE.md'), claudeMd);

    // Merge skills (unless disabled)
    let skillsResult = { added: [] as string[], skipped: [] as string[] };
    if (options.skills !== false) {
      spinner.text = 'Merging skills...';
      mkdirSync(join(workspacePath, '.claude', 'skills'), { recursive: true });
      skillsResult = mergeSkillsIntoWorkspace(workspacePath);
    }

    spinner.succeed('Workspace created!');

    console.log('');
    console.log(chalk.bold('Workspace Details:'));
    console.log(`  Path:   ${chalk.cyan(workspacePath)}`);
    console.log(`  Branch: ${chalk.dim(branchName)}`);
    console.log('');

    if (options.skills !== false) {
      console.log(chalk.bold('Skills:'));
      console.log(`  Added:   ${skillsResult.added.length} Panopticon skills`);
      if (skillsResult.skipped.length > 0) {
        console.log(`  Skipped: ${chalk.dim(skillsResult.skipped.join(', '))}`);
      }
      console.log('');
    }

    console.log(chalk.dim(`Next: cd ${workspacePath}`));

  } catch (error: any) {
    spinner.fail(error.message);
    process.exit(1);
  }
}

async function listCommand(options: { json?: boolean }): Promise<void> {
  const projectRoot = process.cwd();

  // Check if we're in a git repo
  if (!existsSync(join(projectRoot, '.git'))) {
    console.error(chalk.red('Not a git repository.'));
    process.exit(1);
  }

  const worktrees = listWorktrees(projectRoot);

  // Filter to workspaces directory only
  const workspaces = worktrees.filter((w) =>
    w.path.includes('/workspaces/') || w.path.includes('\\workspaces\\')
  );

  if (options.json) {
    console.log(JSON.stringify(workspaces, null, 2));
    return;
  }

  if (workspaces.length === 0) {
    console.log(chalk.dim('No workspaces found.'));
    console.log(chalk.dim('Create one with: pan workspace create <issue-id>'));
    return;
  }

  console.log(chalk.bold('\nWorkspaces\n'));

  for (const ws of workspaces) {
    const name = basename(ws.path);
    const status = ws.prunable ? chalk.yellow(' (prunable)') : '';
    console.log(`${chalk.cyan(name)}${status}`);
    console.log(`  Branch: ${ws.branch || chalk.dim('(detached)')}`);
    console.log(`  Path:   ${chalk.dim(ws.path)}`);
    console.log('');
  }
}

async function destroyCommand(
  issueId: string,
  options: { force?: boolean }
): Promise<void> {
  const spinner = ora('Destroying workspace...').start();

  try {
    const normalizedId = issueId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const folderName = `feature-${normalizedId}`;
    const projectRoot = process.cwd();
    const workspacePath = join(projectRoot, 'workspaces', folderName);

    if (!existsSync(workspacePath)) {
      spinner.fail(`Workspace not found: ${workspacePath}`);
      process.exit(1);
    }

    spinner.text = 'Removing git worktree...';
    removeWorktree(projectRoot, workspacePath);

    spinner.succeed(`Workspace destroyed: ${folderName}`);

  } catch (error: any) {
    spinner.fail(error.message);
    if (!options.force) {
      console.log(chalk.dim('Tip: Use --force to remove even with uncommitted changes'));
    }
    process.exit(1);
  }
}
