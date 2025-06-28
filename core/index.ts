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

const program = new Command();

program
  .name('shellington')
  .description('AI-powered shell with remote UI')
  .version('1.0.0');

program
  .command('shell')
  .description('Start the interactive shell with TUI')
  .option('--no-ai', 'Disable AI assistant')
  .action((options) => {
    if (!options.ai) {
      process.env.SHELLINGTON_NO_AI = 'true';
    }
    const tui = new TUI();
    tui.start();
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

// Default action - start the shell
if (!process.argv.slice(2).length) {
  const tui = new TUI();
  tui.start();
} else {
  program.parse();
}