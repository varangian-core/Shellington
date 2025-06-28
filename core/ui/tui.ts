import blessed from 'blessed';
import { CommandExecutor } from '../shell/executor.js';
import { HistoryManager } from '../history/manager.js';
import { AIAssistant } from '../ai/assistant.js';
import { CommandResult, CommandHistoryEntry } from '../../shared/types.js';
import chalk from 'chalk';

export class TUI {
  private screen: blessed.Widgets.Screen;
  private outputBox: blessed.Widgets.BoxElement;
  private inputBox: blessed.Widgets.TextboxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private historyBox: blessed.Widgets.ListElement;
  
  private executor: CommandExecutor;
  private historyManager: HistoryManager;
  private aiAssistant: AIAssistant;
  
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private aiMode: boolean = false;
  private isProcessing: boolean = false;

  constructor() {
    this.executor = new CommandExecutor();
    this.historyManager = new HistoryManager();
    this.aiAssistant = new AIAssistant();
    
    try {
      this.screen = blessed.screen({
        smartCSR: true,
        title: 'Shellington - AI-Powered Shell',
        // Force basic terminal capabilities
        terminal: process.env.TERM || 'xterm',
        fullUnicode: true,
        forceUnicode: true,
        // Disable problematic features for compatibility
        dockBorders: false,
        ignoreDockContrast: true,
      });

      this.setupUI();
      this.setupKeybindings();
      this.setupErrorHandling();
    } catch (error) {
      console.error('Failed to initialize TUI:', error.message);
      console.log('Try running with: TERM=xterm-256color npm run dev:tui');
      process.exit(1);
    }
  }

  private setupUI(): void {
    try {
      // Output display
      this.outputBox = blessed.box({
        top: 0,
        left: 0,
        width: '70%',
        height: '90%',
        content: chalk.green('Welcome to Shellington!\n'),
        tags: true,
        border: {
          type: 'line',
        },
        style: {
          border: {
            fg: 'cyan',
          },
        },
        scrollable: true,
        alwaysScroll: true,
        mouse: true,
        label: ' Output ',
        // Add scroll bar
        scrollbar: {
          ch: ' ',
          track: {
            bg: 'cyan'
          },
          style: {
            inverse: true
          }
        },
      });

      // History sidebar
      this.historyBox = blessed.list({
        top: 0,
        right: 0,
        width: '30%',
        height: '90%',
        border: {
          type: 'line',
        },
        style: {
          border: {
            fg: 'yellow',
          },
          selected: {
            bg: 'blue',
          },
        },
        scrollable: true,
        mouse: true,
        keys: true,
        label: ' History ',
        items: [],
      });

      // Status bar
      this.statusBar = blessed.box({
        bottom: 1,
        left: 0,
        width: '100%',
        height: 1,
        content: this.getStatusContent(),
        tags: true,
        style: {
          bg: 'blue',
          fg: 'white',
        },
      });

      // Input box with better error handling
      this.inputBox = blessed.textbox({
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        inputOnFocus: true,
        style: {
          bg: 'black',
          fg: 'white',
        },
        // Add these for better compatibility
        keys: true,
        mouse: true,
        vi: false,
      });

      this.screen.append(this.outputBox);
      this.screen.append(this.historyBox);
      this.screen.append(this.statusBar);
      this.screen.append(this.inputBox);

      // Ensure input box is ready
      this.inputBox.readInput(() => {
        this.inputBox.focus();
      });

      this.screen.render();
      
      // Load history after a small delay to ensure everything is ready
      setTimeout(() => {
        this.loadRecentHistory().catch(err => {
          this.appendOutput(chalk.yellow(`Warning: Could not load history: ${err.message}\n`));
        });
      }, 100);

    } catch (error) {
      console.error('Error setting up UI:', error);
      throw error;
    }
  }

  private setupKeybindings(): void {
    // Exit on Ctrl+C or q
    let exitConfirm = false;
    this.screen.key(['C-c', 'q'], () => {
      if (!exitConfirm) {
        exitConfirm = true;
        this.appendOutput(chalk.yellow('\nPress Ctrl+C again to exit (or type "exit")\n'));
        setTimeout(() => { exitConfirm = false; }, 2000);
      } else {
        this.cleanup();
        process.exit(0);
      }
    });

    // Force quit on Ctrl+D
    this.screen.key('C-d', () => {
      this.cleanup();
      process.exit(0);
    });

    // Toggle AI mode with Ctrl+A
    this.screen.key('C-a', () => {
      this.aiMode = !this.aiMode;
      this.updateStatus();
      this.screen.render();
    });

    // Clear screen with Ctrl+L
    this.screen.key('C-l', () => {
      this.outputBox.setContent('');
      this.screen.render();
    });

    // Clear input with Ctrl+U (like in bash)
    this.inputBox.key('C-u', () => {
      this.inputBox.setValue('');
      this.screen.render();
    });

    // Emergency reset with Ctrl+R
    this.screen.key('C-r', () => {
      this.resetInput();
      this.appendOutput(chalk.yellow('\n[Input reset]\n'));
    });

    // Command history navigation
    this.inputBox.key('up', () => {
      if (this.commandHistory.length === 0) return;
      
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        const command = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        this.inputBox.setValue(command);
        this.screen.render();
      }
    });

    this.inputBox.key('down', () => {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        const command = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        this.inputBox.setValue(command);
        this.screen.render();
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1;
        this.inputBox.setValue('');
        this.screen.render();
      }
    });

    // Execute command on Enter
    this.setupEnterHandler();

    // History item selection
    this.historyBox.on('select', (item) => {
      if (!item) return;
      const command = item.getText();
      this.inputBox.setValue(command);
      this.inputBox.focus();
      this.screen.render();
    });
  }

  private setupErrorHandling(): void {
    // Handle screen errors
    this.screen.on('error', (err) => {
      console.error('Screen error:', err);
      this.cleanup();
      process.exit(1);
    });

    // Handle process errors
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
      this.cleanup();
      process.exit(1);
    });

    // Handle terminal resize
    this.screen.on('resize', () => {
      this.screen.render();
    });
  }

  private setupEnterHandler(): void {
    // Remove any existing enter handlers first
    this.inputBox.unkey('enter');
    
    // Add the enter handler
    this.inputBox.key('enter', async () => {
      if (this.isProcessing) {
        this.appendOutput(chalk.yellow('\nCommand already processing, please wait...\n'));
        return;
      }

      const input = this.inputBox.getValue().trim();
      if (!input) return;

      // Clear input immediately
      this.inputBox.clearValue();
      this.inputBox.setValue('');
      this.screen.render();

      // Add to history
      this.commandHistory.push(input);
      this.historyIndex = -1;

      // Set processing flag
      this.isProcessing = true;
      
      try {
        if (this.aiMode) {
          await this.handleAIInput(input);
        } else {
          await this.executeCommand(input);
        }
      } catch (error) {
        this.appendOutput(chalk.red(`\nError: ${error.message}\n`));
      } finally {
        this.isProcessing = false;
        // Ensure input is focused and ready
        this.inputBox.focus();
        this.screen.render();
      }
    });
  }

  private resetInput(): void {
    try {
      this.inputBox.clearValue();
      this.inputBox.setValue('');
      this.inputBox.focus();
      this.screen.render();
    } catch (error) {
      // If all else fails, try to recreate the input box
      console.error('Input reset failed, recreating...', error);
      this.recreateInputBox();
    }
  }

  private recreateInputBox(): void {
    try {
      // Remove old input box
      if (this.inputBox) {
        this.screen.remove(this.inputBox);
      }

      // Create new input box
      this.inputBox = blessed.textbox({
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        inputOnFocus: true,
        style: {
          bg: 'black',
          fg: 'white',
        },
        keys: true,
        mouse: true,
        vi: false,
      });

      this.screen.append(this.inputBox);
      this.inputBox.readInput(() => {
        this.inputBox.focus();
      });
      
      // Re-setup handlers using the dedicated method
      this.setupEnterHandler();
      
      // Re-setup other input handlers
      this.inputBox.key('C-u', () => {
        this.inputBox.setValue('');
        this.screen.render();
      });

      this.screen.render();
    } catch (error) {
      this.appendOutput(chalk.red(`\nCritical error recreating input: ${error.message}\n`));
    }
  }

  private async executeCommand(command: string): Promise<void> {
    // Handle built-in commands
    if (command === 'clear') {
      this.outputBox.setContent('');
      this.screen.render();
      return;
    }

    if (command === 'exit' || command === 'quit') {
      this.cleanup();
      process.exit(0);
    }

    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim();
      try {
        this.executor.changeDirectory(dir);
        this.appendOutput(`${chalk.blue('Changed directory to:')} ${this.executor.getCurrentDirectory()}\n`);
      } catch (error) {
        this.appendOutput(`${chalk.red('Error:')} ${error.message}\n`);
      }
      this.updateStatus();
      return;
    }

    if (command === 'history') {
      try {
        const history = await this.historyManager.search({ limit: 20 });
        this.displayHistory(history);
      } catch (error) {
        this.appendOutput(`${chalk.red('Error loading history:')} ${error.message}\n`);
      }
      return;
    }

    if (command === 'stats') {
      try {
        const stats = await this.historyManager.getStatistics();
        this.displayStatistics(stats);
      } catch (error) {
        this.appendOutput(`${chalk.red('Error loading statistics:')} ${error.message}\n`);
      }
      return;
    }

    if (command === 'help') {
      this.displayHelp();
      return;
    }

    // Execute external command
    this.appendOutput(`${chalk.green('$')} ${command}\n`);
    
    try {
      const result = await this.executor.execute(command);
      await this.historyManager.addEntry(result);
      
      if (result.stdout) {
        this.appendOutput(result.stdout);
      }
      
      if (result.stderr) {
        this.appendOutput(chalk.red(result.stderr));
      }
      
      if (result.exitCode !== 0) {
        this.appendOutput(chalk.red(`\nCommand exited with code ${result.exitCode}\n`));
        this.appendOutput(chalk.yellow('Tip: Press Ctrl+A to enable AI mode for help with this error\n'));
      }
      
      this.appendOutput('\n');
      await this.updateHistorySidebar();
    } catch (error) {
      this.appendOutput(`${chalk.red('Execution error:')} ${error.message}\n`);
    }
  }

  private async handleAIInput(input: string): Promise<void> {
    this.appendOutput(`${chalk.cyan('AI>')} ${input}\n`);
    
    try {
      // Check if this is a request to convert to command
      if (input.toLowerCase().includes('run') || input.toLowerCase().includes('execute')) {
        const command = await this.aiAssistant.suggestCommand(input);
        if (command) {
          this.appendOutput(`${chalk.cyan('Suggested command:')} ${command}\n`);
          this.appendOutput(chalk.yellow('Press Enter to execute or modify the command\n'));
          this.inputBox.setValue(command);
          this.aiMode = false;
          this.updateStatus();
          return;
        }
      }
      
      // Check if asking about last error
      const lastCommand = await this.historyManager.getLastCommand();
      if (lastCommand && lastCommand.exitCode !== 0 && 
          (input.toLowerCase().includes('error') || input.toLowerCase().includes('fix'))) {
        const analysis = await this.aiAssistant.analyzeError(lastCommand);
        this.appendOutput(`${chalk.cyan('AI Analysis:')}\n${analysis}\n\n`);
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
      
      this.appendOutput(`${chalk.cyan('AI:')} ${response.content}\n\n`);
    } catch (error) {
      this.appendOutput(`${chalk.red('AI Error:')} ${error.message}\n`);
      if (error.message.includes('API key')) {
        this.appendOutput(chalk.yellow('Please set your ANTHROPIC_API_KEY in the .env file\n'));
      }
    }
  }

  private displayHelp(): void {
    this.appendOutput(chalk.bold('\nShellington Help:\n'));
    this.appendOutput('\nCommands:\n');
    this.appendOutput('  help      - Show this help message\n');
    this.appendOutput('  history   - Show command history\n');
    this.appendOutput('  stats     - Show command statistics\n');
    this.appendOutput('  clear     - Clear the screen\n');
    this.appendOutput('  exit/quit - Exit Shellington\n');
    this.appendOutput('\nKeyboard Shortcuts:\n');
    this.appendOutput('  Ctrl+A - Toggle AI mode\n');
    this.appendOutput('  Ctrl+L - Clear screen\n');
    this.appendOutput('  Ctrl+U - Clear current input\n');
    this.appendOutput('  Ctrl+R - Reset input (emergency)\n');
    this.appendOutput('  Ctrl+C - Exit\n');
    this.appendOutput('  Up/Down - Navigate command history\n');
    this.appendOutput('\n');
  }

  private appendOutput(text: string): void {
    try {
      const currentContent = this.outputBox.getContent();
      this.outputBox.setContent(currentContent + text);
      this.outputBox.setScrollPerc(100);
      this.screen.render();
    } catch (error) {
      console.error('Error appending output:', error);
    }
  }

  private updateStatus(): void {
    try {
      this.statusBar.setContent(this.getStatusContent());
      this.screen.render();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  private getStatusContent(): string {
    const mode = this.aiMode ? chalk.cyan(' AI Mode ') : chalk.green(' Shell Mode ');
    const dir = chalk.white(` ${this.executor.getCurrentDirectory()} `);
    const help = chalk.yellow(' Ctrl+A: Toggle AI | Ctrl+U: Clear Input | Ctrl+C: Exit ');
    
    return `${mode}${dir}${help}`;
  }

  private async loadRecentHistory(): Promise<void> {
    const recent = await this.historyManager.search({ limit: 50 });
    await this.updateHistorySidebar(recent);
  }

  private async updateHistorySidebar(entries?: CommandHistoryEntry[]): Promise<void> {
    if (!entries) {
      entries = await this.historyManager.search({ limit: 50 });
    }
    
    const items = entries.map(entry => {
      const status = entry.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
      return `${status} ${entry.command}`;
    });
    
    try {
      this.historyBox.setItems(items);
      this.screen.render();
    } catch (error) {
      console.error('Error updating history sidebar:', error);
    }
  }

  private displayHistory(entries: CommandHistoryEntry[]): void {
    this.appendOutput(chalk.bold('\nCommand History:\n'));
    entries.forEach(entry => {
      const status = entry.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
      const time = entry.timestamp.toLocaleString();
      this.appendOutput(`${status} [${time}] ${entry.command}\n`);
    });
    this.appendOutput('\n');
  }

  private displayStatistics(stats: any): void {
    this.appendOutput(chalk.bold('\nShell Statistics:\n'));
    this.appendOutput(`Total commands: ${stats.totalCommands}\n`);
    this.appendOutput(`Successful: ${chalk.green(stats.successfulCommands)}\n`);
    this.appendOutput(`Failed: ${chalk.red(stats.failedCommands)}\n`);
    this.appendOutput(`\n${chalk.bold('Most used commands:')}\n`);
    stats.mostUsedCommands.forEach((cmd: any) => {
      this.appendOutput(`  ${cmd.command}: ${cmd.count} times\n`);
    });
    this.appendOutput('\n');
  }

  private cleanup(): void {
    try {
      this.historyManager.close();
      if (this.screen) {
        this.screen.destroy();
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  start(): void {
    try {
      this.screen.render();
      this.appendOutput('Type "help" for available commands\n\n');
    } catch (error) {
      console.error('Failed to start TUI:', error);
      this.cleanup();
      process.exit(1);
    }
  }
}