import chalk from 'chalk';
import { listRunningAgents } from '../../../lib/agents.js';

interface StatusOptions {
  json?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const agents = listRunningAgents();

  if (options.json) {
    console.log(JSON.stringify(agents, null, 2));
    return;
  }

  if (agents.length === 0) {
    console.log(chalk.dim('No running agents.'));
    console.log(chalk.dim('Use "pan work issue <id>" to spawn one.'));
    return;
  }

  console.log(chalk.bold('\nRunning Agents\n'));

  for (const agent of agents) {
    const statusColor = agent.tmuxActive ? chalk.green : chalk.red;
    const status = agent.tmuxActive ? 'running' : 'stopped';

    const startedAt = new Date(agent.startedAt);
    const duration = Math.floor((Date.now() - startedAt.getTime()) / 1000 / 60);

    console.log(`${chalk.cyan(agent.id)}`);
    console.log(`  Issue:    ${agent.issueId}`);
    console.log(`  Status:   ${statusColor(status)}`);
    console.log(`  Runtime:  ${agent.runtime} (${agent.model})`);
    console.log(`  Duration: ${duration} min`);
    console.log(`  Workspace: ${chalk.dim(agent.workspace)}`);
    console.log('');
  }
}
