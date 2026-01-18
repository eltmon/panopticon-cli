import chalk from 'chalk';
import ora from 'ora';
import { spawnAgent } from '../../../lib/agents.js';

interface IssueOptions {
  model: string;
  runtime: string;
  dryRun?: boolean;
}

export async function issueCommand(id: string, options: IssueOptions): Promise<void> {
  const spinner = ora(`Preparing workspace for ${id}...`).start();

  try {
    // Normalize issue ID (MIN-648 -> min-648 for tmux session name)
    const normalizedId = id.toLowerCase();

    // For now, use current directory as workspace
    // Phase 5 will add proper workspace creation with worktrees
    const workspace = process.cwd();

    if (options.dryRun) {
      spinner.info('Dry run mode');
      console.log('');
      console.log(chalk.bold('Would create:'));
      console.log(`  Agent ID:   agent-${normalizedId}`);
      console.log(`  Workspace:  ${workspace}`);
      console.log(`  Runtime:    ${options.runtime}`);
      console.log(`  Model:      ${options.model}`);
      return;
    }

    spinner.text = 'Spawning agent...';

    const agent = spawnAgent({
      issueId: id,
      workspace,
      runtime: options.runtime,
      model: options.model,
      prompt: `You are working on issue ${id}. Check beads for context: bd show ${id}`,
    });

    spinner.succeed(`Agent spawned: ${agent.id}`);

    console.log('');
    console.log(chalk.bold('Agent Details:'));
    console.log(`  Session:    ${chalk.cyan(agent.id)}`);
    console.log(`  Workspace:  ${workspace}`);
    console.log(`  Runtime:    ${agent.runtime} (${agent.model})`);
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
