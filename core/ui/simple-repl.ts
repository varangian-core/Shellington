import readline from 'readline';
import { CommandExecutor } from '../shell/executor.js';
import { HistoryManager } from '../history/manager.js';
import { AIAssistant } from '../ai/assistant.js';
import chalk from 'chalk';
import os from 'os';

export class SimpleREPL {
  private rl: readline.Interface;
  private executor: CommandExecutor;
  private historyManager: HistoryManager;
  private aiAssistant: AIAssistant;
  private aiMode: boolean = false;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;

  constructor() {
    this.executor = new CommandExecutor();
    this.historyManager = new HistoryManager();
    this.aiAssistant = new AIAssistant();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getPrompt(),
      historySize: 1000,
      removeHistoryDuplicates: true,
    });

    this.setupHandlers();
  }

  private getPrompt(): string {
    const mode = this.aiMode ? chalk.cyan('[AI] ') : '';
    const dir = chalk.blue(this.executor.getCurrentDirectory());
    const symbol = chalk.green(' $ ');
    const shellington = chalk.magenta('[🐚] ');
    return `${shellington}${mode}${dir}${symbol}`;
  }

  private setupHandlers(): void {
    // Handle line input
    this.rl.on('line', async (input) => {
      const command = input.trim();
      
      if (!command) {
        this.rl.prompt();
        return;
      }

      // Add to local history
      this.commandHistory.push(command);
      this.historyIndex = -1;

      try {
        if (this.aiMode) {
          await this.handleAIInput(command);
        } else {
          await this.handleCommand(command);
        }
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }

      this.rl.setPrompt(this.getPrompt());
      this.rl.prompt();
    });

    // Handle Ctrl+C
    let ctrlCCount = 0;
    this.rl.on('SIGINT', () => {
      ctrlCCount++;
      if (ctrlCCount === 1) {
        console.log(chalk.yellow('\n(To exit, type "exit" or press Ctrl+C again)'));
        this.rl.prompt();
        // Reset count after 2 seconds
        setTimeout(() => { ctrlCCount = 0; }, 2000);
      } else {
        console.log(chalk.yellow('\nExiting...'));
        this.rl.close();
      }
    });

    // Handle close
    this.rl.on('close', () => {
      this.cleanup();
      process.exit(0);
    });

    // Custom key bindings
    process.stdin.on('keypress', (char, key) => {
      if (!key) return;

      // Ctrl+A to toggle AI mode
      if (key.ctrl && key.name === 'a') {
        this.aiMode = !this.aiMode;
        console.log(chalk.yellow(`\nSwitched to ${this.aiMode ? 'AI' : 'Shell'} mode`));
        this.rl.setPrompt(this.getPrompt());
        this.rl.prompt();
        return;
      }

      // Ctrl+L to clear screen
      if (key.ctrl && key.name === 'l') {
        console.clear();
        this.rl.prompt();
        return;
      }
    });
  }

  private async handleCommand(command: string): Promise<void> {
    // Debug: log when handleCommand is called
    if (process.env.DEBUG) {
      console.log(chalk.gray(`[DEBUG] handleCommand called with: "${command}"`));
    }
    
    // Handle built-in commands
    switch (command) {
      case 'help':
        this.showHelp();
        return;

      case 'clear':
        console.clear();
        return;

      case 'exit':
      case 'quit':
        this.rl.close();
        return;

      case 'history':
        await this.showHistory();
        return;

      case 'stats':
        await this.showStats();
        return;

      case 'ai':
        this.aiMode = true;
        console.log(chalk.yellow('Switched to AI mode'));
        return;

      case 'shell':
        this.aiMode = false;
        console.log(chalk.yellow('Switched to Shell mode'));
        return;
    }

    // Handle cd command
    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim();
      try {
        this.executor.changeDirectory(dir);
        console.log(chalk.blue(`Changed directory to: ${this.executor.getCurrentDirectory()}`));
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      return;
    }

    // Execute external command
    console.log(chalk.gray(`[DEBUG] About to execute: ${command}`));
    try {
      const result = await this.executor.execute(command);
      console.log(chalk.gray(`[DEBUG] Execution complete. stdout length: ${result.stdout.length}`));
      await this.historyManager.addEntry(result);
      
      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      
      if (result.stderr) {
        process.stderr.write(chalk.red(result.stderr));
      }
      
      if (result.exitCode !== 0) {
        console.error(chalk.red(`\nCommand exited with code ${result.exitCode}`));
        console.log(chalk.yellow('Tip: Type "ai" to switch to AI mode for help'));
      }
    } catch (error) {
      console.error(chalk.red(`Execution error: ${error.message}`));
    }
  }

  private async handleAIInput(input: string): Promise<void> {
    console.log(chalk.cyan(`AI> ${input}`));
    
    try {
      // Check for command conversion
      if (input.toLowerCase().includes('run') || input.toLowerCase().includes('execute')) {
        const command = await this.aiAssistant.suggestCommand(input);
        if (command) {
          console.log(chalk.cyan(`Suggested command: ${command}`));
          console.log(chalk.yellow('Copy and paste to execute, or type "shell" to switch modes'));
          return;
        }
      }

      // Check for error help
      const lastCommand = await this.historyManager.getLastCommand();
      if (lastCommand && lastCommand.exitCode !== 0 && 
          (input.toLowerCase().includes('error') || input.toLowerCase().includes('fix'))) {
        const analysis = await this.aiAssistant.analyzeError(lastCommand);
        console.log(chalk.cyan('AI Analysis:'));
        console.log(analysis);
        return;
      }

      // General AI chat
      const response = await this.aiAssistant.processRequest({
        type: 'chat',
        query: input,
        context: {
          workingDirectory: this.executor.getCurrentDirectory(),
          lastCommand: lastCommand || undefined,
        },
      });
      
      console.log(chalk.cyan('AI:'), response.content);
    } catch (error) {
      console.error(chalk.red(`AI Error: ${error.message}`));
      if (error.message.includes('API key')) {
        console.log(chalk.yellow('Please set your ANTHROPIC_API_KEY in the .env file'));
      }
    }
  }

  private showHelp(): void {
    console.log(chalk.bold('\nShellington Simple Mode\n'));
    console.log('Commands:');
    console.log('  help      - Show this help');
    console.log('  history   - Show command history');
    console.log('  stats     - Show statistics');
    console.log('  clear     - Clear screen');
    console.log('  ai        - Switch to AI mode');
    console.log('  shell     - Switch to Shell mode');
    console.log('  exit      - Exit Shellington\n');
    console.log('Keyboard shortcuts:');
    console.log('  Ctrl+A    - Toggle AI/Shell mode');
    console.log('  Ctrl+L    - Clear screen');
    console.log('  Ctrl+C    - Cancel current input\n');
  }

  private async showHistory(): Promise<void> {
    try {
      const entries = await this.historyManager.search({ limit: 20 });
      console.log(chalk.bold('\nCommand History:'));
      entries.forEach(entry => {
        const status = entry.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
        const time = new Date(entry.timestamp).toLocaleTimeString();
        console.log(`${status} [${time}] ${entry.command}`);
      });
    } catch (error) {
      console.error(chalk.red(`Error loading history: ${error.message}`));
    }
  }

  private async showStats(): Promise<void> {
    try {
      const stats = await this.historyManager.getStatistics();
      console.log(chalk.bold('\nShell Statistics:'));
      console.log(`Total commands: ${stats.totalCommands}`);
      console.log(`Successful: ${chalk.green(stats.successfulCommands)}`);
      console.log(`Failed: ${chalk.red(stats.failedCommands)}`);
      console.log(chalk.bold('\nMost used commands:'));
      stats.mostUsedCommands.forEach(cmd => {
        console.log(`  ${cmd.command}: ${cmd.count} times`);
      });
    } catch (error) {
      console.error(chalk.red(`Error loading statistics: ${error.message}`));
    }
  }

  private cleanup(): void {
    console.log(chalk.yellow('\nGoodbye!'));
    this.historyManager.close();
  }

  start(): void {
    console.log(chalk.green.bold('\nWelcome to Shellington!'));
    console.log(chalk.gray('Simple REPL mode (TUI unavailable)'));
    console.log(chalk.gray('Type "help" for available commands\n'));
    
    this.rl.prompt();
  }
}

// Export a function to start the simple REPL
export function startSimpleREPL(): void {
  const repl = new SimpleREPL();
  repl.start();
}