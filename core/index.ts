#!/usr/bin/env node

import { Command } from 'commander';
import { TUI } from './ui/tui.js';
import { CommandExecutor } from './shell/executor.js';
import { HistoryManager } from './history/manager.js';
import { AIAssistant } from './ai/assistant.js';
import { startAPIServer } from './api/server.js';
import path from 'path';
import fs from 'fs';
import os from 'os';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Check if we're already inside Shellington
if (process.env.SHELLINGTON_ACTIVE === 'true') {
  console.error(chalk.red('Error: Shellington is already running!'));
  console.error(chalk.yellow('You cannot run Shellington inside Shellington.'));
  console.error(chalk.gray('Exit the current session first with "exit" command.'));
  process.exit(1);
}

// Mark that Shellington is active
process.env.SHELLINGTON_ACTIVE = 'true';

// Handle process termination gracefully
process.on('SIGINT', () => {
  // Let individual components handle their own cleanup
  // This is a fallback if they don't
  setTimeout(() => {
    console.log(chalk.yellow('\nForce exiting...'));
    process.exit(0);
  }, 3000);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\nReceived SIGTERM, shutting down...'));
  process.exit(0);
});

const program = new Command();

program
  .name('shellington')
  .description('AI-powered shell with remote UI')
  .version('1.0.0')
  .option('--tui', 'Start Terminal UI (default)')
  .option('--api', 'Start API server')
  .option('--gui', 'Start GUI (not yet implemented)')
  .option('-p, --port <port>', 'API server port', '3001')
  .option('--host <host>', 'API server host', 'localhost')
  .addHelpText('after', `
Examples:
  $ shellington                    Start TUI (default)
  $ shellington --tui              Start Terminal UI
  $ shellington --api              Start API server
  $ shellington --api --port 8080  Start API on port 8080
  
Quick commands:
  $ shellington exec "ls -la"      Execute a command
  $ shellington history            Show command history
  $ shellington ai "help me"       Ask AI assistant

Run 'shellington <command> --help' for command-specific help.
`);

program
  .command('shell')
  .description('Start the interactive shell with TUI')
  .option('--no-ai', 'Disable AI assistant')
  .option('--simple', 'Use simple REPL mode instead of TUI')
  .action((options) => {
    if (!options.ai) {
      process.env.SHELLINGTON_NO_AI = 'true';
    }
    
    if (options.simple || process.env.SHELLINGTON_SIMPLE_MODE === 'true') {
      // Use simple REPL mode
      import('./ui/simple-repl.js').then(({ startSimpleREPL }) => {
        startSimpleREPL();
      }).catch(err => {
        console.error('Failed to load simple REPL:', err);
        process.exit(1);
      });
    } else {
      // Check if we should use simple mode for problematic terminals
      const termType = process.env.TERM || '';
      const problematicTerms = ['ghostty', 'xterm-ghostty'];
      const shouldUseSimple = problematicTerms.some(term => termType.includes(term));
      
      if (shouldUseSimple) {
        console.log(chalk.yellow(`Detected ${termType} terminal, using simple mode for better compatibility`));
        import('./ui/simple-repl.js').then(({ startSimpleREPL }) => {
          startSimpleREPL();
        }).catch(err => {
          console.error('Failed to load simple REPL:', err);
          process.exit(1);
        });
      } else {
        // Try TUI first, fall back to simple REPL on error
        try {
          const tui = new TUI();
          tui.start();
        } catch (error) {
          console.error(chalk.yellow('TUI initialization failed, falling back to simple mode'));
          console.error(chalk.gray(`Error: ${error.message}`));
          import('./ui/simple-repl.js').then(({ startSimpleREPL }) => {
            startSimpleREPL();
          }).catch(err => {
            console.error('Failed to load simple REPL:', err);
            process.exit(1);
          });
        }
      }
    }
  });

program
  .command('exec <command>')
  .description('Execute a single command')
  .option('-d, --directory <path>', 'Working directory')
  .action(async (command, options) => {
    const executor = new CommandExecutor();
    const historyManager = new HistoryManager();
    
    if (options.directory) {
      executor.changeDirectory(options.directory);
    }
    
    const result = await executor.execute(command);
    await historyManager.addEntry(result);
    
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    
    historyManager.close();
    process.exit(result.exitCode);
  });

program
  .command('history')
  .description('Search command history')
  .option('-k, --keyword <keyword>', 'Search by keyword')
  .option('-n, --limit <number>', 'Limit results', '20')
  .option('-u, --user <user>', 'Filter by user')
  .option('--failed', 'Show only failed commands')
  .action(async (options) => {
    const historyManager = new HistoryManager();
    
    const searchOptions: any = {
      limit: parseInt(options.limit),
    };
    
    if (options.keyword) searchOptions.keyword = options.keyword;
    if (options.user) searchOptions.user = options.user;
    if (options.failed) searchOptions.exitCode = 1;
    
    const results = await historyManager.search(searchOptions);
    
    results.forEach(entry => {
      const status = entry.exitCode === 0 ? '✓' : '✗';
      console.log(`${status} [${entry.timestamp.toISOString()}] ${entry.command}`);
    });
    
    historyManager.close();
  });

program
  .command('ai <query>')
  .description('Query the AI assistant')
  .option('-c, --command', 'Convert query to command')
  .option('-e, --explain', 'Explain the last command')
  .action(async (query, options) => {
    const aiAssistant = new AIAssistant();
    
    if (options.command) {
      const command = await aiAssistant.suggestCommand(query);
      if (command) {
        console.log(command);
      } else {
        console.error('Could not generate command from query');
        process.exit(1);
      }
    } else if (options.explain) {
      const explanation = await aiAssistant.explainCommand(query);
      console.log(explanation);
    } else {
      const response = await aiAssistant.processRequest({
        type: 'chat',
        query,
      });
      console.log(response.content);
    }
  });

program
  .command('server')
  .description('Start the API server for remote UI')
  .option('-p, --port <port>', 'Server port', '3001')
  .option('--host <host>', 'Server host', 'localhost')
  .action(async (options) => {
    const port = parseInt(options.port);
    await startAPIServer(port, options.host);
  });

program
  .command('init')
  .description('Initialize Shellington configuration')
  .action(() => {
    const configDir = path.join(os.homedir(), '.shellington');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log(`Created configuration directory: ${configDir}`);
    }
    
    const configFile = path.join(configDir, 'config.json');
    if (!fs.existsSync(configFile)) {
      const defaultConfig = {
        ai: {
          enabled: true,
          model: 'claude-3-opus-20240229',
        },
        security: {
          remoteEnabled: false,
          authRequired: true,
        },
        ui: {
          theme: 'default',
        },
      };
      
      fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
      console.log(`Created configuration file: ${configFile}`);
    }
    
    console.log('Shellington initialized successfully!');
  });

// Parse command line arguments
program.parse();

// Handle default action with flags
const options = program.opts();

// If no subcommand was provided, handle the main flags
if (!process.argv.slice(2).some(arg => !arg.startsWith('-'))) {
  if (options.gui) {
    console.error('GUI mode is not yet implemented. Please use --tui or --api');
    process.exit(1);
  } else if (options.api) {
    // Start API server
    const port = parseInt(options.port);
    startAPIServer(port, options.host).catch(console.error);
  } else {
    // Default to TUI mode (also if --tui is specified)
    // But use simple mode if requested or if TUI fails
    if (process.env.SHELLINGTON_SIMPLE_MODE === 'true') {
      import('./ui/simple-repl.js').then(({ startSimpleREPL }) => {
        startSimpleREPL();
      });
    } else {
      // Check terminal compatibility
      const termType = process.env.TERM || '';
      const problematicTerms = ['ghostty', 'xterm-ghostty'];
      const shouldUseSimple = problematicTerms.some(term => termType.includes(term));
      
      if (shouldUseSimple) {
        console.log(chalk.yellow(`Detected ${termType} terminal, using simple mode for better compatibility`));
        import('./ui/simple-repl.js').then(({ startSimpleREPL }) => {
          startSimpleREPL();
        });
      } else {
        try {
          const tui = new TUI();
          tui.start();
        } catch (error) {
          console.error(chalk.yellow('TUI initialization failed, falling back to simple mode'));
          import('./ui/simple-repl.js').then(({ startSimpleREPL }) => {
            startSimpleREPL();
          });
        }
      }
    }
  }
}