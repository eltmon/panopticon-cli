import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
import { createWorktree, removeWorktree, listWorktrees } from '../../lib/worktree.js';
import { generateClaudeMd, TemplateVariables } from '../../lib/template.js';
import { mergeSkillsIntoWorkspace } from '../../lib/skills-merge.js';
import {
  resolveProjectFromIssue,
  hasProjects,
  PROJECTS_CONFIG_FILE,
  findProjectByTeam,
  extractTeamPrefix,
} from '../../lib/projects.js';
import { TemplateEngine } from '../../lib/template-engine.js';
import { PortManager } from '../../lib/port-manager.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export function registerWorkspaceCommands(program: Command): void {
  const workspace = program.command('workspace').description('Workspace management');

  workspace
    .command('create <issueId>')
    .description('Create workspace for issue')
    .option('--dry-run', 'Show what would be created')
    .option('--no-skills', 'Skip skills symlink setup')
    .option('--labels <labels>', 'Comma-separated labels for routing (e.g., docs,marketing)')
    .option('--project <path>', 'Explicit project path (overrides registry)')
    .option('--template <name>', 'Docker template to use (spring-boot-react, nextjs-fullstack, python-fastapi, monorepo)')
    .option('--docker', 'Enable Docker-based workspace (auto-detect template if not specified)')
    .option('--no-traefik', 'Disable Traefik routing')
    .option('--shared-db', 'Use shared database instead of isolated')
    .action(createCommand);

  workspace
    .command('templates')
    .description('List available Docker templates')
    .action(listTemplatesCommand);

  workspace
    .command('list')
    .description('List all workspaces')
    .option('--json', 'Output as JSON')
    .option('--all', 'List workspaces across all registered projects')
    .action(listCommand);

  workspace
    .command('destroy <issueId>')
    .description('Destroy workspace')
    .option('--force', 'Force removal even with uncommitted changes')
    .option('--project <path>', 'Explicit project path (overrides registry)')
    .action(destroyCommand);
}

interface CreateOptions {
  dryRun?: boolean;
  skills?: boolean;
  labels?: string;
  project?: string;
  template?: string;
  docker?: boolean;
  traefik?: boolean;
  sharedDb?: boolean;
}

async function listTemplatesCommand(): Promise<void> {
  const templateEngine = new TemplateEngine([
    join(__dirname, '..', '..', '..', 'templates', 'docker'),
  ]);

  const templates = templateEngine.listTemplates();

  if (templates.length === 0) {
    console.log(chalk.dim('No templates found.'));
    return;
  }

  console.log(chalk.bold('\nAvailable Docker Templates\n'));

  for (const tpl of templates) {
    console.log(chalk.cyan(tpl.name));
    console.log(`  ${tpl.manifest.description || chalk.dim('No description')}`);
    console.log(`  Services: ${tpl.manifest.services?.join(', ') || 'none'}`);
    console.log('');
  }
}

/**
 * Auto-detect the project template based on files in the project root
 */
function detectProjectTemplate(projectRoot: string): string | undefined {
  // Check for Spring Boot (pom.xml with spring-boot)
  if (existsSync(join(projectRoot, 'pom.xml'))) {
    // Check if there's also a React/Vite frontend
    if (existsSync(join(projectRoot, 'frontend', 'package.json')) ||
        existsSync(join(projectRoot, 'client', 'package.json'))) {
      return 'spring-boot-react';
    }
    return undefined; // Spring Boot only, use default docker template
  }

  // Check for Next.js
  if (existsSync(join(projectRoot, 'next.config.js')) ||
      existsSync(join(projectRoot, 'next.config.mjs')) ||
      existsSync(join(projectRoot, 'next.config.ts'))) {
    return 'nextjs-fullstack';
  }

  // Check for Python FastAPI
  if ((existsSync(join(projectRoot, 'requirements.txt')) ||
       existsSync(join(projectRoot, 'pyproject.toml'))) &&
      existsSync(join(projectRoot, 'main.py'))) {
    return 'python-fastapi';
  }

  // Check for Node.js monorepo
  if (existsSync(join(projectRoot, 'package.json'))) {
    const packageJson = require(join(projectRoot, 'package.json'));
    if (packageJson.workspaces) {
      return 'monorepo';
    }
  }

  return undefined;
}

async function createCommand(issueId: string, options: CreateOptions): Promise<void> {
  const spinner = ora('Creating workspace...').start();

  try {
    // Normalize issue ID (e.g., MIN-123 -> min-123)
    const normalizedId = issueId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const branchName = `feature/${normalizedId}`;
    const folderName = `feature-${normalizedId}`;

    // Parse labels if provided
    const labels = options.labels
      ? options.labels.split(',').map((l) => l.trim())
      : [];

    // Resolve project root - try registry first, fall back to cwd
    let projectRoot: string;
    let projectName: string | undefined;

    if (options.project) {
      // Explicit project path provided
      projectRoot = options.project;
    } else {
      // Try to resolve from project registry
      const resolved = resolveProjectFromIssue(issueId, labels);
      if (resolved) {
        projectRoot = resolved.projectPath;
        projectName = resolved.projectName;
        spinner.text = `Resolved project: ${projectName} (${projectRoot})`;
      } else if (hasProjects()) {
        // Registry exists but no match found - warn user
        spinner.warn(`No project found for ${issueId} in registry. Using current directory.`);
        spinner.start('Creating workspace...');
        projectRoot = process.cwd();
      } else {
        // No registry - use cwd (backward compatible)
        projectRoot = process.cwd();
      }
    }

    const workspacesDir = join(projectRoot, 'workspaces');
    const workspacePath = join(workspacesDir, folderName);

    if (options.dryRun) {
      spinner.info('Dry run mode');
      console.log('');
      console.log(chalk.bold('Would create:'));
      if (projectName) {
        console.log(`  Project:   ${chalk.green(projectName)}`);
      }
      console.log(`  Root:      ${chalk.dim(projectRoot)}`);
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

    // Check if project has a custom workspace command (e.g., MYN's new-feature script)
    const teamPrefix = extractTeamPrefix(issueId);
    const projectConfig = teamPrefix ? findProjectByTeam(teamPrefix) : null;

    if (projectConfig?.workspace_command) {
      // Use custom workspace command
      spinner.text = `Running custom workspace command...`;

      // The command receives the normalized issue ID (e.g., "min-123")
      const cmd = `${projectConfig.workspace_command} ${normalizedId}`;
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd: projectConfig.path,
          encoding: 'utf-8',
          timeout: 120000, // 2 minute timeout
        });

        if (stdout) {
          console.log(stdout);
        }

        spinner.succeed('Workspace created via custom command!');
        console.log('');
        console.log(chalk.bold('Workspace Details:'));
        console.log(`  Path:   ${chalk.cyan(workspacePath)}`);
        console.log(`  Branch: ${chalk.dim(branchName)}`);
        return;
      } catch (error: any) {
        spinner.fail(`Custom workspace command failed: ${error.message}`);
        if (error.stderr) {
          console.error(error.stderr);
        }
        process.exit(1);
      }
    }

    // Standard workspace creation via git worktree
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
      PROJECT_NAME: projectName,
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

    // Generate Docker configuration from template (if enabled)
    let dockerResult: { success: boolean; filesGenerated: string[]; ports?: Record<string, number> } | undefined;
    if (options.template || options.docker) {
      spinner.text = 'Generating Docker configuration...';

      const templateEngine = new TemplateEngine([
        join(__dirname, '..', '..', '..', 'templates', 'docker'),
      ]);
      const portManager = new PortManager();

      // Determine template to use
      let templateName = options.template;
      if (!templateName && options.docker) {
        // Auto-detect based on project files
        templateName = detectProjectTemplate(projectRoot);
      }

      if (templateName) {
        // Allocate ports for this workspace
        const templates = templateEngine.listTemplates();
        const templateInfo = templates.find(t => t.name === templateName);
        const services = templateInfo?.manifest.services || ['frontend', 'api', 'database'];
        const allocation = portManager.allocate(folderName, services);

        // Build context for template rendering
        const result = templateEngine.generate(templateName, workspacePath, {
          workspace: {
            name: folderName,
            path: workspacePath,
            issueId: issueId.toUpperCase(),
            branch: branchName,
          },
          project: {
            name: projectName || basename(projectRoot),
            path: projectRoot,
          },
          docker: {
            portStrategy: 'offset',
            basePorts: { frontend: 5173, api: 8080, database: 5432, redis: 6379 },
            portOffset: allocation.offset,
            traefik: {
              enabled: options.traefik !== false,
              domain: 'localhost',
              network: 'traefik-public',
            },
            database: {
              strategy: options.sharedDb ? 'shared' : 'isolated',
              image: 'postgres:16-alpine',
              port: 5432,
            },
            caches: {},
          },
          variables: {},
          computed: { ports: allocation.ports },
        });

        dockerResult = {
          success: result.success,
          filesGenerated: result.filesGenerated,
          ports: allocation.ports,
        };

        if (!result.success) {
          spinner.warn(`Docker template warnings: ${result.errors.join(', ')}`);
        }
      }
    }

    spinner.succeed('Workspace created!');

    console.log('');
    console.log(chalk.bold('Workspace Details:'));
    if (projectName) {
      console.log(`  Project: ${chalk.green(projectName)}`);
    }
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

    if (dockerResult) {
      console.log(chalk.bold('Docker:'));
      console.log(`  Files:    ${dockerResult.filesGenerated.join(', ')}`);
      if (dockerResult.ports) {
        const portEntries = Object.entries(dockerResult.ports);
        if (portEntries.length > 0) {
          console.log(`  Ports:    ${portEntries.map(([k, v]) => `${k}:${v}`).join(', ')}`);
        }
      }
      console.log('');
    }

    console.log(chalk.dim(`Next: cd ${workspacePath}`));
    if (dockerResult) {
      console.log(chalk.dim(`      ./dev  # Start Docker containers`));
    }

  } catch (error: any) {
    spinner.fail(error.message);
    process.exit(1);
  }
}

interface ListOptions {
  json?: boolean;
  all?: boolean;
}

async function listCommand(options: ListOptions): Promise<void> {
  const { listProjects } = await import('../../lib/projects.js');
  const projects = listProjects();

  // If we have registered projects and --all is specified, list across all projects
  if (projects.length > 0 && options.all) {
    const allWorkspaces: Array<{
      projectName: string;
      projectPath: string;
      workspaces: ReturnType<typeof listWorktrees>;
    }> = [];

    for (const { key, config } of projects) {
      if (!existsSync(join(config.path, '.git'))) {
        continue;
      }

      const worktrees = listWorktrees(config.path);
      const workspaces = worktrees.filter(
        (w) => w.path.includes('/workspaces/') || w.path.includes('\\workspaces\\')
      );

      if (workspaces.length > 0) {
        allWorkspaces.push({
          projectName: config.name,
          projectPath: config.path,
          workspaces,
        });
      }
    }

    if (options.json) {
      console.log(JSON.stringify(allWorkspaces, null, 2));
      return;
    }

    if (allWorkspaces.length === 0) {
      console.log(chalk.dim('No workspaces found in any registered project.'));
      console.log(chalk.dim('Create one with: pan workspace create <issue-id>'));
      return;
    }

    for (const proj of allWorkspaces) {
      console.log(chalk.bold(`\n${proj.projectName}\n`));
      for (const ws of proj.workspaces) {
        const name = basename(ws.path);
        const status = ws.prunable ? chalk.yellow(' (prunable)') : '';
        console.log(`  ${chalk.cyan(name)}${status}`);
        console.log(`    Branch: ${ws.branch || chalk.dim('(detached)')}`);
        console.log(`    Path:   ${chalk.dim(ws.path)}`);
      }
    }
    return;
  }

  // Default behavior: list from current directory
  const projectRoot = process.cwd();

  // Check if we're in a git repo
  if (!existsSync(join(projectRoot, '.git'))) {
    console.error(chalk.red('Not a git repository.'));
    if (projects.length > 0) {
      console.log(chalk.dim('Tip: Use --all to list workspaces across all registered projects.'));
    }
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
    if (projects.length > 0) {
      console.log(chalk.dim('Tip: Use --all to list workspaces across all registered projects.'));
    }
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

interface DestroyOptions {
  force?: boolean;
  project?: string;
}

async function destroyCommand(issueId: string, options: DestroyOptions): Promise<void> {
  const spinner = ora('Destroying workspace...').start();

  try {
    const normalizedId = issueId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const folderName = `feature-${normalizedId}`;

    // Resolve project root - try registry first, then explicit option, then cwd
    let projectRoot: string;

    if (options.project) {
      projectRoot = options.project;
    } else {
      // Try to resolve from project registry
      const resolved = resolveProjectFromIssue(issueId);
      if (resolved) {
        projectRoot = resolved.projectPath;
      } else {
        projectRoot = process.cwd();
      }
    }

    const workspacePath = join(projectRoot, 'workspaces', folderName);

    if (!existsSync(workspacePath)) {
      // If not found and we resolved from registry, also check cwd
      const cwdPath = join(process.cwd(), 'workspaces', folderName);
      if (projectRoot !== process.cwd() && existsSync(cwdPath)) {
        projectRoot = process.cwd();
      } else {
        spinner.fail(`Workspace not found: ${workspacePath}`);
        process.exit(1);
      }
    }

    const finalWorkspacePath = join(projectRoot, 'workspaces', folderName);

    spinner.text = 'Removing git worktree...';
    removeWorktree(projectRoot, finalWorkspacePath);

    spinner.succeed(`Workspace destroyed: ${folderName}`);
  } catch (error: any) {
    spinner.fail(error.message);
    if (!options.force) {
      console.log(chalk.dim('Tip: Use --force to remove even with uncommitted changes'));
    }
    process.exit(1);
  }
}
