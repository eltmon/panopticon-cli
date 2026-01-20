/**
 * Convoy CLI Commands
 *
 * Manage parallel agent execution through convoys
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  createConvoy,
  startConvoy,
  stopConvoy,
  pauseConvoy,
  resumeConvoy,
  getConvoy,
  listConvoys,
  deleteConvoy,
  getConvoyStatus,
  generateSynthesisPrompt,
} from '../../lib/convoy.js';

export function createConvoyCommand(): Command {
  const convoy = new Command('convoy')
    .description('Manage parallel agent execution (convoys)');

  // Create a new convoy
  convoy
    .command('create <name>')
    .description('Create a new convoy from multiple issues')
    .option('-i, --issues <ids>', 'Comma-separated issue IDs', '')
    .option('-c, --concurrency <n>', 'Max concurrent agents', '3')
    .option('-s, --synthesis', 'Enable synthesis agent after completion')
    .option('-t, --timeout <ms>', 'Per-agent timeout in ms', '3600000')
    .action(async (name: string, options) => {
      try {
        const issueIds = options.issues
          ? options.issues.split(',').map((id: string) => id.trim())
          : [];

        if (issueIds.length === 0) {
          console.log(chalk.red('Error: At least one issue ID required'));
          console.log(chalk.dim('Usage: pan convoy create "My Convoy" --issues MYN-1,MYN-2,MYN-3'));
          process.exit(1);
        }

        const manifest = createConvoy(name, issueIds, {
          maxParallel: parseInt(options.concurrency, 10),
          synthesize: options.synthesis || false,
          timeout: parseInt(options.timeout, 10),
        });

        console.log(chalk.green('✓ Convoy created'));
        console.log(`  ID: ${chalk.cyan(manifest.id)}`);
        console.log(`  Name: ${manifest.name}`);
        console.log(`  Agents: ${manifest.agents.length}`);
        console.log(`  Concurrency: ${manifest.config.maxParallel}`);
        console.log();
        console.log(chalk.dim('Start with: pan convoy start ' + manifest.id));
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Start a convoy
  convoy
    .command('start <id>')
    .description('Start a convoy (spawn agents)')
    .action(async (id: string) => {
      try {
        console.log(chalk.dim('Starting convoy...'));
        const success = await startConvoy(id);

        if (success) {
          console.log(chalk.green('✓ Convoy started'));
          console.log(chalk.dim('Monitor with: pan convoy status ' + id));
        } else {
          console.log(chalk.red('Failed to start convoy'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Stop a convoy
  convoy
    .command('stop <id>')
    .description('Stop a running convoy')
    .action(async (id: string) => {
      try {
        const success = await stopConvoy(id);

        if (success) {
          console.log(chalk.green('✓ Convoy stopped'));
        } else {
          console.log(chalk.red('Failed to stop convoy'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Pause a convoy
  convoy
    .command('pause <id>')
    .description('Pause a convoy (stop spawning new agents)')
    .action((id: string) => {
      try {
        const success = pauseConvoy(id);

        if (success) {
          console.log(chalk.green('✓ Convoy paused'));
          console.log(chalk.dim('Running agents will complete, no new agents will spawn'));
        } else {
          console.log(chalk.red('Failed to pause convoy'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Resume a paused convoy
  convoy
    .command('resume <id>')
    .description('Resume a paused convoy')
    .action(async (id: string) => {
      try {
        const success = await resumeConvoy(id);

        if (success) {
          console.log(chalk.green('✓ Convoy resumed'));
        } else {
          console.log(chalk.red('Failed to resume convoy'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // List convoys
  convoy
    .command('list')
    .description('List all convoys')
    .option('-a, --all', 'Include completed convoys')
    .action((options) => {
      try {
        const convoys = listConvoys();

        if (convoys.length === 0) {
          console.log(chalk.dim('No convoys found'));
          console.log(chalk.dim('Create one with: pan convoy create "Name" --issues ID1,ID2'));
          return;
        }

        const filtered = options.all
          ? convoys
          : convoys.filter(c => !['completed', 'failed'].includes(c.status));

        if (filtered.length === 0) {
          console.log(chalk.dim('No active convoys'));
          console.log(chalk.dim('Use --all to see completed convoys'));
          return;
        }

        console.log(chalk.bold('Convoys'));
        console.log();

        for (const c of filtered) {
          const statusColor = {
            pending: chalk.dim,
            running: chalk.blue,
            paused: chalk.yellow,
            completed: chalk.green,
            failed: chalk.red,
          }[c.status] || chalk.white;

          const completed = c.agents.filter(a => a.status === 'completed').length;
          const running = c.agents.filter(a => a.status === 'running').length;

          console.log(`${statusColor('●')} ${chalk.cyan(c.id)} ${c.name}`);
          console.log(`  Status: ${statusColor(c.status)}`);
          console.log(`  Progress: ${completed}/${c.agents.length} complete, ${running} running`);
          console.log();
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Get convoy status
  convoy
    .command('status <id>')
    .description('Get detailed status of a convoy')
    .action((id: string) => {
      try {
        const manifest = getConvoy(id);

        if (!manifest) {
          console.log(chalk.red('Convoy not found:'), id);
          process.exit(1);
        }

        const status = getConvoyStatus(id);

        console.log(chalk.bold(manifest.name));
        console.log(chalk.dim('ID: ' + manifest.id));
        console.log();

        const statusColor = {
          pending: chalk.dim,
          running: chalk.blue,
          paused: chalk.yellow,
          completed: chalk.green,
          failed: chalk.red,
        }[manifest.status] || chalk.white;

        console.log(`Status: ${statusColor(manifest.status)}`);
        console.log(`Created: ${new Date(manifest.createdAt).toLocaleString()}`);
        console.log(`Concurrency: ${manifest.config.maxParallel}`);
        console.log();

        console.log(chalk.bold('Agents'));
        console.log();

        for (const agent of manifest.agents) {
          const agentColor = {
            pending: chalk.dim,
            running: chalk.blue,
            completed: chalk.green,
            failed: chalk.red,
          }[agent.status] || chalk.white;

          console.log(`  ${agentColor('●')} ${agent.issueId}`);
          console.log(`    Status: ${agentColor(agent.status)}`);
          if (agent.startedAt) {
            console.log(`    Started: ${new Date(agent.startedAt).toLocaleString()}`);
          }
          if (agent.completedAt) {
            console.log(`    Completed: ${new Date(agent.completedAt).toLocaleString()}`);
          }
          if (agent.error) {
            console.log(`    ${chalk.red('Error:')} ${agent.error}`);
          }
        }

        if (status) {
          console.log();
          console.log(chalk.bold('Summary'));
          console.log(`  Completed: ${status.completedCount}/${status.totalAgents}`);
          console.log(`  Running: ${status.runningCount}`);
          console.log(`  Failed: ${status.failedCount}`);
          console.log(`  Progress: ${(status.progress * 100).toFixed(0)}%`);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Delete a convoy
  convoy
    .command('delete <id>')
    .description('Delete a convoy')
    .option('-f, --force', 'Force delete even if running')
    .action(async (id: string, options) => {
      try {
        const manifest = getConvoy(id);

        if (!manifest) {
          console.log(chalk.red('Convoy not found:'), id);
          process.exit(1);
        }

        if (manifest.status === 'running' && !options.force) {
          console.log(chalk.yellow('Convoy is running. Stop it first or use --force'));
          process.exit(1);
        }

        if (manifest.status === 'running') {
          await stopConvoy(id);
        }

        const success = deleteConvoy(id);

        if (success) {
          console.log(chalk.green('✓ Convoy deleted'));
        } else {
          console.log(chalk.red('Failed to delete convoy'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Generate synthesis prompt
  convoy
    .command('synthesize <id>')
    .description('Generate synthesis prompt for completed convoy')
    .action((id: string) => {
      try {
        const manifest = getConvoy(id);

        if (!manifest) {
          console.log(chalk.red('Convoy not found:'), id);
          process.exit(1);
        }

        if (manifest.status !== 'completed') {
          console.log(chalk.yellow('Convoy not yet completed. Status:'), manifest.status);
          process.exit(1);
        }

        const prompt = generateSynthesisPrompt(manifest);

        console.log(chalk.bold('Synthesis Prompt'));
        console.log();
        console.log(prompt);
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  return convoy;
}
