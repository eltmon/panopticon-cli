import { existsSync, mkdirSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { INIT_DIRS, CONFIG_FILE, PANOPTICON_HOME } from '../../lib/paths.js';
import { getDefaultConfig, saveConfig } from '../../lib/config.js';
import { detectShell, getShellRcFile, addAlias, getAliasInstructions } from '../../lib/shell.js';

export async function initCommand(): Promise<void> {
  const spinner = ora('Initializing Panopticon...').start();

  // Check if already initialized
  if (existsSync(CONFIG_FILE)) {
    spinner.info('Panopticon already initialized');
    console.log(chalk.dim(`  Config: ${CONFIG_FILE}`));
    console.log(chalk.dim(`  Home: ${PANOPTICON_HOME}`));
    return;
  }

  try {
    // Create all directories
    for (const dir of INIT_DIRS) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    spinner.text = 'Created directories...';

    // Write default config
    const config = getDefaultConfig();
    saveConfig(config);
    spinner.text = 'Created config...';

    // Detect shell and add alias
    const shell = detectShell();
    const rcFile = getShellRcFile(shell);

    if (rcFile && existsSync(rcFile)) {
      addAlias(rcFile);
      spinner.succeed('Panopticon initialized!');
      console.log('');
      console.log(chalk.green('✓') + ' Created ' + chalk.cyan(PANOPTICON_HOME));
      console.log(chalk.green('✓') + ' Created ' + chalk.cyan(CONFIG_FILE));
      console.log(chalk.green('✓') + ' ' + getAliasInstructions(shell));
    } else {
      spinner.succeed('Panopticon initialized!');
      console.log('');
      console.log(chalk.green('✓') + ' Created ' + chalk.cyan(PANOPTICON_HOME));
      console.log(chalk.green('✓') + ' Created ' + chalk.cyan(CONFIG_FILE));
      console.log(chalk.yellow('!') + ' Could not detect shell. Add alias manually:');
      console.log(chalk.dim('    alias pan="panopticon"'));
    }

    console.log('');
    console.log('Next steps:');
    console.log(chalk.dim('  1. Add skills to ~/.panopticon/skills/'));
    console.log(chalk.dim('  2. Run: pan sync'));

  } catch (error: any) {
    spinner.fail('Failed to initialize');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}
