/**
 * Hooks CLI Commands
 *
 * Manage project lifecycle hooks
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  listHooks,
  addHook,
  removeHook,
  setHookEnabled,
  loadProjectHooks,
  saveProjectHooks,
  createDefaultHooksConfig,
  executeHooksForEvent,
  type LifecycleEvent,
  type HookConfig,
} from '../../lib/hooks.js';

const LIFECYCLE_EVENTS: LifecycleEvent[] = [
  'workspace:create',
  'workspace:destroy',
  'agent:spawn',
  'agent:stop',
  'agent:complete',
  'agent:error',
  'release:start',
  'release:complete',
  'release:fail',
  'sync:before',
  'sync:after',
  'build:start',
  'build:complete',
  'build:fail',
  'test:start',
  'test:complete',
  'test:fail',
];

export function createHooksCommand(): Command {
  const hooks = new Command('hooks')
    .description('Manage project lifecycle hooks');

  // List hooks
  hooks
    .command('list')
    .description('List all hooks for a project')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .option('-e, --event <event>', 'Filter by event type')
    .action((options) => {
      try {
        const allHooks = listHooks(options.dir);

        if (allHooks.length === 0) {
          console.log(chalk.dim('No hooks configured'));
          console.log(chalk.dim('Initialize with: pan hooks init'));
          return;
        }

        const filtered = options.event
          ? allHooks.filter(h => h.event === options.event)
          : allHooks;

        if (filtered.length === 0) {
          console.log(chalk.dim(`No hooks for event: ${options.event}`));
          return;
        }

        console.log(chalk.bold('Project Hooks'));
        console.log();

        // Group by event
        const byEvent = new Map<string, HookConfig[]>();
        for (const hook of filtered) {
          if (!byEvent.has(hook.event)) {
            byEvent.set(hook.event, []);
          }
          byEvent.get(hook.event)!.push(hook);
        }

        for (const [event, eventHooks] of byEvent) {
          console.log(chalk.cyan(event));
          for (const hook of eventHooks) {
            const status = hook.enabled ? chalk.green('●') : chalk.dim('○');
            console.log(`  ${status} ${hook.name}`);
            if (hook.command) {
              console.log(`    ${chalk.dim('command:')} ${hook.command}`);
            }
            if (hook.script) {
              console.log(`    ${chalk.dim('script:')} ${hook.script}`);
            }
            if (hook.timeout) {
              console.log(`    ${chalk.dim('timeout:')} ${hook.timeout}ms`);
            }
          }
          console.log();
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Initialize hooks
  hooks
    .command('init')
    .description('Initialize hooks configuration with defaults')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .option('-f, --force', 'Overwrite existing config')
    .action((options) => {
      try {
        const existing = loadProjectHooks(options.dir);

        if (existing && !options.force) {
          console.log(chalk.yellow('Hooks configuration already exists'));
          console.log(chalk.dim('Use --force to overwrite'));
          return;
        }

        const config = createDefaultHooksConfig();
        saveProjectHooks(options.dir, config);

        console.log(chalk.green('✓ Hooks configuration created'));
        console.log(chalk.dim(`File: ${options.dir}/panopticon.hooks.json`));
        console.log();
        console.log('Default hooks:');
        for (const hook of config.hooks) {
          const status = hook.enabled ? chalk.green('enabled') : chalk.dim('disabled');
          console.log(`  ${hook.event}: ${hook.name} (${status})`);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Add a hook
  hooks
    .command('add <event> <name>')
    .description('Add a new hook')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .option('-c, --command <cmd>', 'Command to execute')
    .option('-s, --script <path>', 'Script file to execute')
    .option('-t, --timeout <ms>', 'Timeout in milliseconds', '60000')
    .option('--continue-on-error', 'Continue execution even if hook fails')
    .action((event: string, name: string, options) => {
      try {
        if (!LIFECYCLE_EVENTS.includes(event as LifecycleEvent)) {
          console.log(chalk.red('Invalid event type:'), event);
          console.log(chalk.dim('Valid events:'), LIFECYCLE_EVENTS.join(', '));
          process.exit(1);
        }

        if (!options.command && !options.script) {
          console.log(chalk.red('Either --command or --script is required'));
          process.exit(1);
        }

        const hookConfig: HookConfig = {
          event: event as LifecycleEvent,
          name,
          enabled: true,
          command: options.command,
          script: options.script,
          timeout: parseInt(options.timeout, 10),
          continueOnError: options.continueOnError || false,
        };

        addHook(options.dir, hookConfig);

        console.log(chalk.green('✓ Hook added'));
        console.log(`  Event: ${hookConfig.event}`);
        console.log(`  Name: ${hookConfig.name}`);
        if (hookConfig.command) {
          console.log(`  Command: ${hookConfig.command}`);
        }
        if (hookConfig.script) {
          console.log(`  Script: ${hookConfig.script}`);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Remove a hook
  hooks
    .command('remove <event> <name>')
    .description('Remove a hook')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .action((event: string, name: string, options) => {
      try {
        const success = removeHook(options.dir, event as LifecycleEvent, name);

        if (success) {
          console.log(chalk.green('✓ Hook removed'));
        } else {
          console.log(chalk.red('Hook not found'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Enable a hook
  hooks
    .command('enable <event> <name>')
    .description('Enable a hook')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .action((event: string, name: string, options) => {
      try {
        const success = setHookEnabled(options.dir, event as LifecycleEvent, name, true);

        if (success) {
          console.log(chalk.green('✓ Hook enabled'));
        } else {
          console.log(chalk.red('Hook not found'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Disable a hook
  hooks
    .command('disable <event> <name>')
    .description('Disable a hook')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .action((event: string, name: string, options) => {
      try {
        const success = setHookEnabled(options.dir, event as LifecycleEvent, name, false);

        if (success) {
          console.log(chalk.green('✓ Hook disabled'));
        } else {
          console.log(chalk.red('Hook not found'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // Run hooks for an event
  hooks
    .command('run <event>')
    .description('Manually run hooks for an event')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .option('-e, --env <key=value...>', 'Environment variables')
    .action(async (event: string, options) => {
      try {
        if (!LIFECYCLE_EVENTS.includes(event as LifecycleEvent)) {
          console.log(chalk.red('Invalid event type:'), event);
          console.log(chalk.dim('Valid events:'), LIFECYCLE_EVENTS.join(', '));
          process.exit(1);
        }

        // Parse environment variables
        const env: Record<string, string> = {};
        if (options.env) {
          for (const item of options.env) {
            const [key, ...valueParts] = item.split('=');
            env[key] = valueParts.join('=');
          }
        }

        console.log(chalk.dim(`Running hooks for: ${event}`));
        console.log();

        const results = await executeHooksForEvent(
          options.dir,
          event as LifecycleEvent,
          env
        );

        if (results.length === 0) {
          console.log(chalk.dim('No hooks configured for this event'));
          return;
        }

        let allSuccess = true;
        for (const result of results) {
          const status = result.success ? chalk.green('✓') : chalk.red('✗');
          const duration = `${result.duration}ms`;

          console.log(`${status} ${result.hookName} (${duration})`);

          if (!result.success) {
            allSuccess = false;
            if (result.error) {
              console.log(`  ${chalk.red('Error:')} ${result.error}`);
            }
            if (result.stderr) {
              console.log(`  ${chalk.dim('stderr:')} ${result.stderr.slice(0, 200)}`);
            }
          }

          if (result.stdout) {
            const lines = result.stdout.split('\n').slice(0, 5);
            for (const line of lines) {
              console.log(chalk.dim(`  ${line}`));
            }
          }
        }

        console.log();
        if (allSuccess) {
          console.log(chalk.green(`All ${results.length} hooks completed successfully`));
        } else {
          const failed = results.filter(r => !r.success).length;
          console.log(chalk.red(`${failed}/${results.length} hooks failed`));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red('Error:'), error.message);
        process.exit(1);
      }
    });

  // List available events
  hooks
    .command('events')
    .description('List available lifecycle events')
    .action(() => {
      console.log(chalk.bold('Available Lifecycle Events'));
      console.log();

      const categories: Record<string, LifecycleEvent[]> = {
        'Workspace': ['workspace:create', 'workspace:destroy'],
        'Agent': ['agent:spawn', 'agent:stop', 'agent:complete', 'agent:error'],
        'Release': ['release:start', 'release:complete', 'release:fail'],
        'Sync': ['sync:before', 'sync:after'],
        'Build': ['build:start', 'build:complete', 'build:fail'],
        'Test': ['test:start', 'test:complete', 'test:fail'],
      };

      for (const [category, events] of Object.entries(categories)) {
        console.log(chalk.cyan(category));
        for (const event of events) {
          console.log(`  ${event}`);
        }
        console.log();
      }
    });

  return hooks;
}
