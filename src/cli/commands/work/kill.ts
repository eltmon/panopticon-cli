import chalk from 'chalk';
import { stopAgent, getAgentState } from '../../../lib/agents.js';
import { sessionExists } from '../../../lib/tmux.js';

interface KillOptions {
  force?: boolean;
}

export async function killCommand(id: string, options: KillOptions): Promise<void> {
  const agentId = id.startsWith('agent-') ? id : `agent-${id.toLowerCase()}`;

  // Check if exists
  const state = getAgentState(agentId);
  const isRunning = sessionExists(agentId);

  if (!state && !isRunning) {
    console.log(chalk.yellow(`Agent ${agentId} not found.`));
    return;
  }

  if (!options.force && isRunning) {
    // In a real implementation, we'd prompt for confirmation
    // For now, just proceed
  }

  try {
    stopAgent(agentId);
    console.log(chalk.green(`Killed agent: ${agentId}`));
  } catch (error: any) {
    console.error(chalk.red('Error: ' + error.message));
    process.exit(1);
  }
}
