import readline from 'readline';
import { CommandExecutor } from '../shell/executor.js';
import { HistoryManager } from '../history/manager.js';
import { AIAssistant } from '../ai/assistant.js';
import { CommandResult, CommandHistoryEntry } from '../../shared/types.js';
import chalk from 'chalk';
import os from 'os';

interface ExecutionState {
  command: string;
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
  output: string;
}

export class EnhancedREPL {
  private rl: readline.Interface;
  private executor: CommandExecutor;
  private historyManager: HistoryManager;
  private aiAssistant: AIAssistant;
  private aiMode: boolean = false;
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private currentExecution: ExecutionState | null = null;
  private displayMode: 'split' | 'focused' = 'split';
  private lastResults: CommandHistoryEntry[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

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
    this.startDisplay();
  }

  private getPrompt(): string {
    const mode = this.aiMode ? chalk.cyan('[AI] ') : '';
    const dir = chalk.blue(this.executor.getCurrentDirectory());
    const symbol = chalk.green(' $ ');
    const shellington = chalk.magenta('[🐚] ');
    const status = this.currentExecution ? chalk.yellow('[↻] ') : '';
    return `${shellington}${status}${mode}${dir}${symbol}`;
  }

  private startDisplay(): void {
    // Update display every 500ms when command is running
    this.updateInterval = setInterval(() => {
      if (this.currentExecution && this.currentExecution.status === 'running') {
        this.refreshDisplay();
      }
    }, 500);

    // Initial display
    this.refreshDisplay();
  }

  private async refreshDisplay(): Promise<void> {
    // Clear screen and move cursor to top
    process.stdout.write('\x1b[2J\x1b[H');

    // Display header
    this.displayHeader();

    // Display content based on mode
    if (this.displayMode === 'split') {
      await this.displaySplitView();
    } else {
      await this.displayFocusedView();
    }

    // Redraw prompt at bottom
    this.rl.prompt(true);
  }

  private displayHeader(): void {
    const width = process.stdout.columns || 80;
    const title = ' Shellington - Enhanced Shell ';
    const padding = Math.floor((width - title.length) / 2);
    const header = chalk.bgBlue.white('='.repeat(padding) + title + '='.repeat(padding));
    
    console.log(header);
    console.log(chalk.gray(`Mode: ${this.displayMode} | AI: ${this.aiMode ? 'ON' : 'OFF'} | ` +
                           `Ctrl+H for help | Ctrl+T to toggle view\n`));
  }

  private async displaySplitView(): Promise<void> {
    const width = process.stdout.columns || 80;
    const height = process.stdout.rows || 24;
    const contentHeight = height - 8; // Leave room for header, prompt, etc.

    // Left side: Current execution
    const leftWidth = Math.floor(width * 0.6);
    const rightWidth = width - leftWidth - 3;

    console.log(chalk.bold('Current Execution') + ' '.repeat(leftWidth - 17) + '│ ' + chalk.bold('Recent History'));
    console.log('─'.repeat(leftWidth) + '┼' + '─'.repeat(rightWidth + 1));

    // Get recent history
    if (this.lastResults.length === 0) {
      this.lastResults = await this.historyManager.search({ limit: 20 });
    }

    // Display content
    const maxLines = contentHeight - 2;
    for (let i = 0; i < maxLines; i++) {
      let leftContent = '';
      let rightContent = '';

      // Left side - current execution
      if (this.currentExecution) {
        if (i === 0) {
          const elapsed = Date.now() - this.currentExecution.startTime.getTime();
          const elapsedStr = `${(elapsed / 1000).toFixed(1)}s`;
          leftContent = chalk.yellow(`$ ${this.currentExecution.command} (${elapsedStr})`);
        } else if (i === 1) {
          leftContent = chalk.gray('─'.repeat(leftWidth));
        } else {
          const outputLines = this.currentExecution.output.split('\n');
          const lineIndex = i - 2;
          if (lineIndex < outputLines.length) {
            leftContent = this.truncate(outputLines[lineIndex], leftWidth);
          }
        }
      } else if (i === 0) {
        leftContent = chalk.gray('No command running');
      }

      // Right side - history
      if (i < this.lastResults.length) {
        const entry = this.lastResults[i];
        const status = entry.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const cmd = this.truncate(entry.command, rightWidth - 12);
        rightContent = `${status} ${chalk.gray(time)} ${cmd}`;
      }

      // Pad and display
      leftContent = leftContent.padEnd(leftWidth, ' ');
      rightContent = rightContent.padEnd(rightWidth, ' ');
      console.log(leftContent + '│ ' + rightContent);
    }
  }

  private async displayFocusedView(): Promise<void> {
    if (this.currentExecution) {
      console.log(chalk.yellow(`Executing: ${this.currentExecution.command}`));
      const elapsed = Date.now() - this.currentExecution.startTime.getTime();
      console.log(chalk.gray(`Elapsed: ${(elapsed / 1000).toFixed(1)}s`));
      console.log(chalk.gray('─'.repeat(process.stdout.columns || 80)));
      console.log(this.currentExecution.output);
    } else {
      // Show recent history
      console.log(chalk.bold('Recent Command History'));
      console.log(chalk.gray('─'.repeat(process.stdout.columns || 80)));
      
      const history = await this.historyManager.search({ limit: 15 });
      history.forEach(entry => {
        const status = entry.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
        const time = new Date(entry.timestamp).toLocaleTimeString();
        console.log(`${status} [${time}] ${entry.command}`);
        if (entry.exitCode !== 0 && entry.stderr) {
          console.log(chalk.red(`   └─ ${this.truncate(entry.stderr.trim(), 70)}`));
        }
      });
    }
  }

  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  private setupHandlers(): void {
    // Handle line input
    this.rl.on('line', async (input) => {
      const command = input.trim();
      
      if (!command) {
        this.refreshDisplay();
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

      this.refreshDisplay();
    });

    // Handle Ctrl+C
    let ctrlCCount = 0;
    this.rl.on('SIGINT', () => {
      if (this.currentExecution && this.currentExecution.status === 'running') {
        console.log(chalk.yellow('\nStopping current execution...'));
        // In a real implementation, we'd kill the child process
        this.currentExecution.status = 'failed';
        this.currentExecution = null;
      } else {
        ctrlCCount++;
        if (ctrlCCount === 1) {
          console.log(chalk.yellow('\n(To exit, type "exit" or press Ctrl+C again)'));
          setTimeout(() => { ctrlCCount = 0; }, 2000);
        } else {
          this.cleanup();
          process.exit(0);
        }
      }
      this.refreshDisplay();
    });

    // Handle key bindings
    process.stdin.on('keypress', (char, key) => {
      if (!key) return;

      // Debug: Log key presses (remove in production)
      if (process.env.DEBUG_KEYS === 'true') {
        console.log('\nKey pressed:', key);
      }

      // Ctrl+H - Help (also try F1)
      if ((key.ctrl && key.name === 'h') || key.name === 'f1') {
        this.showQuickHelp();
        return;
      }

      // Ctrl+T - Toggle view (also try F2)
      if ((key.ctrl && key.name === 't') || key.name === 'f2') {
        this.displayMode = this.displayMode === 'split' ? 'focused' : 'split';
        this.refreshDisplay();
        return;
      }

      // Ctrl+A - Toggle AI mode
      if (key.ctrl && key.name === 'a') {
        this.aiMode = !this.aiMode;
        this.rl.setPrompt(this.getPrompt());
        this.refreshDisplay();
        return;
      }

      // Ctrl+L - Clear and refresh
      if (key.ctrl && key.name === 'l') {
        this.currentExecution = null;
        this.refreshDisplay();
        return;
      }

      // Ctrl+R - Refresh history
      if (key.ctrl && key.name === 'r') {
        this.lastResults = [];
        this.refreshDisplay();
        return;
      }
    });

    // Handle up/down for history
    process.stdin.on('keypress', (char, key) => {
      if (!key) return;

      if (key.name === 'up') {
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
          this.rl.write(null, { ctrl: true, name: 'u' }); // Clear line
          this.rl.write(cmd);
        }
      } else if (key.name === 'down') {
        if (this.historyIndex > 0) {
          this.historyIndex--;
          const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
          this.rl.write(null, { ctrl: true, name: 'u' }); // Clear line
          this.rl.write(cmd);
        } else if (this.historyIndex === 0) {
          this.historyIndex = -1;
          this.rl.write(null, { ctrl: true, name: 'u' }); // Clear line
        }
      }
    });
  }

  private async handleCommand(command: string): Promise<void> {
    // Handle built-in commands
    switch (command) {
      case 'help':
        this.showHelp();
        return;

      case 'clear':
        this.currentExecution = null;
        this.refreshDisplay();
        return;

      case 'exit':
      case 'quit':
        this.cleanup();
        process.exit(0);

      case 'history':
        await this.showFullHistory();
        return;

      case 'stats':
        await this.showStats();
        return;

      case 'split':
        this.displayMode = 'split';
        this.refreshDisplay();
        return;

      case 'focused':
        this.displayMode = 'focused';
        this.refreshDisplay();
        return;

      case 'toggle':
        this.displayMode = this.displayMode === 'split' ? 'focused' : 'split';
        this.refreshDisplay();
        return;
    }

    // Handle cd command
    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim();
      try {
        this.executor.changeDirectory(dir);
        this.rl.setPrompt(this.getPrompt());
      } catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      return;
    }

    // Execute external command
    this.currentExecution = {
      command,
      startTime: new Date(),
      status: 'running',
      output: ''
    };

    this.rl.setPrompt(this.getPrompt());
    this.refreshDisplay();

    try {
      const result = await this.executor.execute(command);
      
      this.currentExecution.status = result.exitCode === 0 ? 'completed' : 'failed';
      this.currentExecution.output = result.stdout + (result.stderr ? chalk.red(result.stderr) : '');
      
      // Add to history
      await this.historyManager.addEntry(result);
      
      // Refresh history cache
      this.lastResults = await this.historyManager.search({ limit: 20 });
      
      // Keep execution visible for a moment
      setTimeout(() => {
        this.currentExecution = null;
        this.rl.setPrompt(this.getPrompt());
        this.refreshDisplay();
      }, 2000);
      
    } catch (error) {
      this.currentExecution.status = 'failed';
      this.currentExecution.output = chalk.red(`Error: ${error.message}`);
    }

    this.refreshDisplay();
  }

  private async handleAIInput(input: string): Promise<void> {
    this.currentExecution = {
      command: `AI: ${input}`,
      startTime: new Date(),
      status: 'running',
      output: chalk.cyan('Thinking...')
    };

    this.refreshDisplay();

    try {
      const response = await this.aiAssistant.processRequest({
        type: 'chat',
        query: input,
        context: {
          workingDirectory: this.executor.getCurrentDirectory(),
        },
      });
      
      this.currentExecution.status = 'completed';
      this.currentExecution.output = chalk.cyan(`AI: ${response.content}`);
      
    } catch (error) {
      this.currentExecution.status = 'failed';
      this.currentExecution.output = chalk.red(`AI Error: ${error.message}`);
    }

    setTimeout(() => {
      this.currentExecution = null;
      this.refreshDisplay();
    }, 3000);
  }

  private showQuickHelp(): void {
    console.log(chalk.bold('\n=== Quick Help ==='));
    console.log('Ctrl+H    - Show this help');
    console.log('Ctrl+T    - Toggle split/focused view');
    console.log('Ctrl+A    - Toggle AI mode');
    console.log('Ctrl+L    - Clear current execution');
    console.log('Ctrl+R    - Refresh history');
    console.log('Ctrl+C    - Stop execution / Exit');
    console.log('\nCommands: help, history, stats, clear, exit');
    console.log('View commands: split, focused, toggle');
    console.log('\nPress any key to continue...');
    
    process.stdin.once('keypress', () => {
      this.refreshDisplay();
    });
  }

  private showHelp(): void {
    console.log(chalk.bold('\nShellington Enhanced Mode\n'));
    console.log('This mode shows current execution alongside command history.\n');
    console.log('Commands:');
    console.log('  help      - Show this help');
    console.log('  history   - Show full command history');
    console.log('  stats     - Show statistics');
    console.log('  clear     - Clear current execution');
    console.log('  split     - Split view mode');
    console.log('  focused   - Focused view mode');
    console.log('  toggle    - Toggle between split/focused view');
    console.log('  exit      - Exit Shellington\n');
    console.log('Keyboard shortcuts:');
    console.log('  Ctrl+H    - Quick help');
    console.log('  Ctrl+T    - Toggle view mode');
    console.log('  Ctrl+A    - Toggle AI/Shell mode');
    console.log('  Ctrl+L    - Clear current execution');
    console.log('  Ctrl+R    - Refresh history');
    console.log('  Ctrl+C    - Stop execution / Exit\n');
  }

  private async showFullHistory(): Promise<void> {
    const entries = await this.historyManager.search({ limit: 50 });
    console.log(chalk.bold('\nCommand History:'));
    entries.forEach(entry => {
      const status = entry.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
      const time = new Date(entry.timestamp).toLocaleString();
      console.log(`${status} [${time}] ${entry.command}`);
    });
  }

  private async showStats(): Promise<void> {
    const stats = await this.historyManager.getStatistics();
    console.log(chalk.bold('\nShell Statistics:'));
    console.log(`Total commands: ${stats.totalCommands}`);
    console.log(`Successful: ${chalk.green(stats.successfulCommands)}`);
    console.log(`Failed: ${chalk.red(stats.failedCommands)}`);
    console.log(chalk.bold('\nMost used commands:'));
    stats.mostUsedCommands.forEach(cmd => {
      console.log(`  ${cmd.command}: ${cmd.count} times`);
    });
  }

  private cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.historyManager.close();
    console.log(chalk.yellow('\nGoodbye!'));
  }

  start(): void {
    console.log(chalk.green.bold('\nWelcome to Shellington Enhanced!'));
    console.log(chalk.gray('Split view shows current execution and history side-by-side'));
    console.log(chalk.gray('Press Ctrl+H for help, Ctrl+T to toggle views'));
    console.log(chalk.gray('Or use commands: toggle, split, focused\n'));
    
    // Enable keypress events
    readline.emitKeypressEvents(process.stdin);
    
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      // We need to handle raw mode carefully with readline
      // The readline interface will manage raw mode for us
      this.rl.on('line', () => {
        // Re-enable raw mode after processing a line
        if (process.stdin.isTTY && process.stdin.setRawMode) {
          process.stdin.setRawMode(true);
        }
      });
      
      // Initial raw mode
      process.stdin.setRawMode(true);
    }
    
    this.refreshDisplay();
  }
}

export function startEnhancedREPL(): void {
  const repl = new EnhancedREPL();
  repl.start();
}