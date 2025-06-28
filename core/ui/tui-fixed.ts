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

  constructor() {
    this.executor = new CommandExecutor();
    this.historyManager = new HistoryManager();
    this.aiAssistant = new AIAssistant();
    
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Shellington - AI-Powered Shell',
      terminal: 'xterm-256color',
      fullUnicode: true,
    });

    this.setupUI();
    this.setupKeybindings();
  }

  private setupUI(): void {
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

    // Input box - CRITICAL: use input:false to handle manually
    this.inputBox = blessed.textbox({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      input: false,  // IMPORTANT: Don't auto-handle input
      inputOnFocus: false,  // IMPORTANT: Prevent auto input mode
      keys: false,  // Handle keys manually
      mouse: true,
      style: {
        bg: 'black',
        fg: 'white',
      },
    });

    this.screen.append(this.outputBox);
    this.screen.append(this.historyBox);
    this.screen.append(this.statusBar);
    this.screen.append(this.inputBox);

    // Manually enable input mode
    this.inputBox.readInput((err, data) => {
      if (!err && data != null) {
        // Process the input
        this.handleInput(data);
      }
    });

    this.inputBox.focus();
    this.screen.render();
    
    this.loadRecentHistory();
  }

  private handleInput(input: string): void {
    const command = input.trim();
    if (!command) {
      this.inputBox.clearValue();
      this.inputBox.focus();
      return;
    }

    // Add to history
    this.commandHistory.push(command);
    this.historyIndex = -1;

    // Clear the input box ONCE
    this.inputBox.clearValue();
    
    // Execute command
    if (this.aiMode) {
      this.handleAIInput(command);
    } else {
      this.executeCommand(command);
    }

    // Re-enable input for next command
    setImmediate(() => {
      this.inputBox.readInput((err, data) => {
        if (!err && data != null) {
          this.handleInput(data);
        }
      });
      this.inputBox.focus();
    });
  }

  private setupKeybindings(): void {
    // Exit handling
    let exitConfirm = false;
    this.screen.key(['C-c'], () => {
      if (!exitConfirm) {
        exitConfirm = true;
        this.appendOutput(chalk.yellow('\nPress Ctrl+C again to exit\n'));
        setTimeout(() => { exitConfirm = false; }, 2000);
      } else {
        this.cleanup();
        process.exit(0);
      }
    });

    // Toggle AI mode
    this.screen.key('C-a', () => {
      this.aiMode = !this.aiMode;
      this.updateStatus();
      this.screen.render();
    });

    // Clear screen
    this.screen.key('C-l', () => {
      this.outputBox.setContent('');
      this.screen.render();
    });

    // Command history navigation
    this.screen.key(['up'], () => {
      if (this.commandHistory.length === 0) return;
      
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        const command = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
        this.inputBox.setValue(command);
        this.screen.render();
      }
    });

    this.screen.key(['down'], () => {
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

    // History item selection
    this.historyBox.on('select', (item) => {
      if (!item) return;
      const command = item.getText();
      this.inputBox.setValue(command);
      this.inputBox.focus();
      this.screen.render();
    });
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
      const history = await this.historyManager.search({ limit: 20 });
      this.displayHistory(history);
      return;
    }

    if (command === 'stats') {
      const stats = await this.historyManager.getStatistics();
      this.displayStatistics(stats);
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
        this.appendOutput(chalk.yellow('Tip: Press Ctrl+A to enable AI mode for help\n'));
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
      const response = await this.aiAssistant.processRequest({
        type: 'chat',
        query: input,
        context: {
          workingDirectory: this.executor.getCurrentDirectory(),
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
    this.appendOutput('  Ctrl+C - Exit (press twice)\n');
    this.appendOutput('  Up/Down - Navigate command history\n');
    this.appendOutput('\n');
  }

  private appendOutput(text: string): void {
    const currentContent = this.outputBox.getContent();
    this.outputBox.setContent(currentContent + text);
    this.outputBox.setScrollPerc(100);
    this.screen.render();
  }

  private updateStatus(): void {
    this.statusBar.setContent(this.getStatusContent());
    this.screen.render();
  }

  private getStatusContent(): string {
    const mode = this.aiMode ? chalk.cyan(' AI Mode ') : chalk.green(' Shell Mode ');
    const dir = chalk.white(` ${this.executor.getCurrentDirectory()} `);
    const help = chalk.yellow(' Ctrl+A: Toggle AI | Ctrl+L: Clear | Ctrl+C: Exit ');
    
    return `${mode}${dir}${help}`;
  }

  private async loadRecentHistory(): Promise<void> {
    try {
      const recent = await this.historyManager.search({ limit: 50 });
      await this.updateHistorySidebar(recent);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  private async updateHistorySidebar(entries?: CommandHistoryEntry[]): Promise<void> {
    if (!entries) {
      entries = await this.historyManager.search({ limit: 50 });
    }
    
    const items = entries.map(entry => {
      const status = entry.exitCode === 0 ? chalk.green('✓') : chalk.red('✗');
      return `${status} ${entry.command}`;
    });
    
    this.historyBox.setItems(items);
    this.screen.render();
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
    this.screen.render();
    this.appendOutput('Type "help" for available commands\n\n');
  }
}