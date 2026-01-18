import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { PANOPTICON_HOME } from '../../lib/paths.js';

const PROJECTS_FILE = join(PANOPTICON_HOME, 'projects.json');

export interface Project {
  name: string;
  path: string;
  type: 'standalone' | 'monorepo';
  linearTeam?: string;
  addedAt: string;
}

function loadProjects(): Project[] {
  if (!existsSync(PROJECTS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(PROJECTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]): void {
  mkdirSync(PANOPTICON_HOME, { recursive: true });
  writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

interface AddOptions {
  name?: string;
  type?: 'standalone' | 'monorepo';
  linearTeam?: string;
}

export async function projectAddCommand(
  projectPath: string,
  options: AddOptions = {}
): Promise<void> {
  const fullPath = resolve(projectPath);

  if (!existsSync(fullPath)) {
    console.log(chalk.red(`Path does not exist: ${fullPath}`));
    return;
  }

  const projects = loadProjects();

  // Check if already registered
  const existing = projects.find((p) => p.path === fullPath);
  if (existing) {
    console.log(chalk.yellow(`Project already registered: ${existing.name}`));
    return;
  }

  // Determine name from directory if not provided
  const name = options.name || fullPath.split('/').pop() || 'unknown';

  // Try to detect Linear team from .panopticon/project.toml or package.json
  let linearTeam = options.linearTeam;
  if (!linearTeam) {
    const projectToml = join(fullPath, '.panopticon', 'project.toml');
    if (existsSync(projectToml)) {
      const content = readFileSync(projectToml, 'utf-8');
      const match = content.match(/team\s*=\s*"([^"]+)"/);
      if (match) linearTeam = match[1];
    }
  }

  const project: Project = {
    name,
    path: fullPath,
    type: options.type || 'standalone',
    linearTeam,
    addedAt: new Date().toISOString(),
  };

  projects.push(project);
  saveProjects(projects);

  console.log(chalk.green(`\u2713 Added project: ${name}`));
  console.log(chalk.dim(`  Path: ${fullPath}`));
  if (linearTeam) {
    console.log(chalk.dim(`  Linear team: ${linearTeam}`));
  }
}

interface ListOptions {
  json?: boolean;
}

export async function projectListCommand(options: ListOptions = {}): Promise<void> {
  const projects = loadProjects();

  if (projects.length === 0) {
    console.log(chalk.dim('No projects registered.'));
    console.log(chalk.dim('Add one with: pan project add <path>'));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }

  console.log(chalk.bold('\nRegistered Projects:\n'));

  for (const project of projects) {
    const exists = existsSync(project.path);
    const statusIcon = exists ? chalk.green('\u2713') : chalk.red('\u2717');

    console.log(`${statusIcon} ${chalk.bold(project.name)}`);
    console.log(`  ${chalk.dim(project.path)}`);
    if (project.linearTeam) {
      console.log(`  ${chalk.cyan(`Linear: ${project.linearTeam}`)}`);
    }
    console.log(`  ${chalk.dim(`Type: ${project.type}`)}`);
    console.log('');
  }
}

export async function projectRemoveCommand(nameOrPath: string): Promise<void> {
  const projects = loadProjects();

  const index = projects.findIndex(
    (p) => p.name === nameOrPath || p.path === resolve(nameOrPath)
  );

  if (index === -1) {
    console.log(chalk.red(`Project not found: ${nameOrPath}`));
    return;
  }

  const removed = projects.splice(index, 1)[0];
  saveProjects(projects);

  console.log(chalk.green(`\u2713 Removed project: ${removed.name}`));
}
