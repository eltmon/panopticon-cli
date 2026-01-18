import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { PANOPTICON_HOME, INIT_DIRS } from '../../lib/paths.js';

export function registerInstallCommand(program: Command): void {
  program
    .command('install')
    .description('Install Panopticon prerequisites')
    .option('--check', 'Check prerequisites only')
    .option('--minimal', 'Skip Traefik and mkcert (use port-based routing)')
    .option('--skip-mkcert', 'Skip mkcert/HTTPS setup')
    .option('--skip-docker', 'Skip Docker network setup')
    .action(installCommand);
}

interface InstallOptions {
  check?: boolean;
  minimal?: boolean;
  skipMkcert?: boolean;
  skipDocker?: boolean;
}

interface PrereqResult {
  name: string;
  passed: boolean;
  message: string;
  fix?: string;
}

function detectPlatform(): 'linux' | 'darwin' | 'win32' | 'wsl' {
  const os = platform();
  if (os === 'linux') {
    // Check for WSL
    try {
      const release = readFileSync('/proc/version', 'utf8').toLowerCase();
      if (release.includes('microsoft') || release.includes('wsl')) {
        return 'wsl';
      }
    } catch {}
    return 'linux';
  }
  return os as 'darwin' | 'win32';
}

function checkCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function checkPrerequisites(): { results: PrereqResult[]; allPassed: boolean } {
  const results: PrereqResult[] = [];

  // Node.js
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
  results.push({
    name: 'Node.js',
    passed: nodeMajor >= 18,
    message: nodeMajor >= 18 ? `v${nodeVersion}` : `v${nodeVersion} (need v18+)`,
    fix: 'Install Node.js 18+ from https://nodejs.org',
  });

  // Git
  const hasGit = checkCommand('git');
  results.push({
    name: 'Git',
    passed: hasGit,
    message: hasGit ? 'installed' : 'not found',
    fix: 'Install git from your package manager',
  });

  // Docker
  const hasDocker = checkCommand('docker');
  let dockerRunning = false;
  if (hasDocker) {
    try {
      execSync('docker info', { stdio: 'pipe' });
      dockerRunning = true;
    } catch {}
  }
  results.push({
    name: 'Docker',
    passed: dockerRunning,
    message: dockerRunning ? 'running' : hasDocker ? 'not running' : 'not found',
    fix: hasDocker ? 'Start Docker Desktop or docker service' : 'Install Docker',
  });

  // tmux
  const hasTmux = checkCommand('tmux');
  results.push({
    name: 'tmux',
    passed: hasTmux,
    message: hasTmux ? 'installed' : 'not found',
    fix: 'apt install tmux / brew install tmux',
  });

  // mkcert (optional but recommended)
  const hasMkcert = checkCommand('mkcert');
  results.push({
    name: 'mkcert',
    passed: hasMkcert,
    message: hasMkcert ? 'installed' : 'not found (optional)',
    fix: 'brew install mkcert / apt install mkcert',
  });

  // Beads CLI
  const hasBeads = checkCommand('bd');
  results.push({
    name: 'Beads CLI (bd)',
    passed: hasBeads,
    message: hasBeads ? 'installed' : 'not found',
    fix: 'cargo install beads-cli',
  });

  return {
    results,
    allPassed: results.filter((r) => r.name !== 'mkcert').every((r) => r.passed),
  };
}

function printPrereqStatus(prereqs: { results: PrereqResult[]; allPassed: boolean }): void {
  console.log(chalk.bold('Prerequisites:\n'));

  for (const result of prereqs.results) {
    const icon = result.passed ? chalk.green('✓') : chalk.red('✗');
    const msg = result.passed ? chalk.dim(result.message) : chalk.yellow(result.message);
    console.log(`  ${icon} ${result.name}: ${msg}`);
    if (!result.passed && result.fix) {
      console.log(`    ${chalk.dim('→ ' + result.fix)}`);
    }
  }
  console.log('');
}

async function installCommand(options: InstallOptions): Promise<void> {
  console.log(chalk.bold('\nPanopticon Installation\n'));

  const plat = detectPlatform();
  console.log(`Platform: ${chalk.cyan(plat)}\n`);

  // Step 1: Check prerequisites
  const prereqs = checkPrerequisites();

  if (options.check) {
    printPrereqStatus(prereqs);
    process.exit(prereqs.allPassed ? 0 : 1);
  }

  printPrereqStatus(prereqs);

  if (!prereqs.allPassed) {
    console.log(chalk.red('Fix prerequisites above before continuing.'));
    console.log(chalk.dim('Tip: Run with --minimal to skip optional components'));
    process.exit(1);
  }

  // Step 2: Initialize directories
  const spinner = ora('Initializing Panopticon directories...').start();
  for (const dir of INIT_DIRS) {
    mkdirSync(dir, { recursive: true });
  }
  spinner.succeed('Directories initialized');

  // Step 3: Docker network
  if (!options.skipDocker) {
    spinner.start('Creating Docker network...');
    try {
      execSync('docker network create panopticon 2>/dev/null || true', { stdio: 'pipe' });
      spinner.succeed('Docker network ready');
    } catch (error) {
      spinner.warn('Docker network setup failed (may already exist)');
    }
  }

  // Step 4: mkcert setup
  if (!options.skipMkcert && !options.minimal) {
    const hasMkcert = checkCommand('mkcert');
    if (hasMkcert) {
      spinner.start('Setting up mkcert CA...');
      try {
        execSync('mkcert -install', { stdio: 'pipe' });

        // Generate certs for localhost
        const certsDir = join(PANOPTICON_HOME, 'certs');
        mkdirSync(certsDir, { recursive: true });

        execSync(
          `mkcert -cert-file "${join(certsDir, 'localhost.pem')}" -key-file "${join(certsDir, 'localhost-key.pem')}" localhost "*.localhost" 127.0.0.1 ::1`,
          { stdio: 'pipe' }
        );
        spinner.succeed('mkcert certificates generated');
      } catch (error) {
        spinner.warn('mkcert setup failed (HTTPS may not work)');
      }
    } else {
      spinner.info('Skipping mkcert (not installed)');
    }
  }

  // Step 5: Create config file if doesn't exist
  const configFile = join(PANOPTICON_HOME, 'config.toml');
  if (!existsSync(configFile)) {
    spinner.start('Creating default config...');
    writeFileSync(
      configFile,
      `# Panopticon configuration
[panopticon]
version = "1.0.0"
default_runtime = "claude"

[dashboard]
port = 3001
api_port = 3002

[sync]
auto_sync = true
strategy = "symlink"

[health]
ping_timeout = "30s"
consecutive_failures = 3
`
    );
    spinner.succeed('Config created');
  }

  // Done!
  console.log('');
  console.log(chalk.green.bold('Installation complete!'));
  console.log('');
  console.log(chalk.bold('Next steps:'));
  console.log(`  1. Run ${chalk.cyan('pan sync')} to sync skills to ~/.claude/`);
  console.log(`  2. Run ${chalk.cyan('pan up')} to start the dashboard`);
  console.log(`  3. Create a workspace with ${chalk.cyan('pan workspace create <issue-id>')}`);
  console.log('');
}
