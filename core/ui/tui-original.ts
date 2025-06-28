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

    // Input box
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
    });

    this.screen.append(this.outputBox);
    this.screen.append(this.historyBox);
    this.screen.append(this.statusBar);
    this.screen.append(this.inputBox);

    this.inputBox.focus();
    this.screen.render();
    
    this.loadRecentHistory();
  }

  private setupKeybindings(): void {
    // Exit on Ctrl+C or q
    this.screen.key(['C-c', 'q'], () => {
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

    // Command history navigation
    this.inputBox.key('up', () => {
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
    this.inputBox.key('enter', async () => {
      const input = this.inputBox.getValue().trim();
      if (!input) return;

      this.commandHistory.push(input);
      this.historyIndex = -1;
      this.inputBox.setValue('');

      if (this.aiMode) {
        await this.handleAIInput(input);
      } else {
        await this.executeCommand(input);
      }

      this.screen.render();
    });

    // History item selection
    this.historyBox.on('select', (item, index) => {
      const command = item.getText();
      this.inputBox.setValue(command);
      this.inputBox.focus();
      this.screen.render();
    });
  }

  private async executeCommand(command: string): Promise<void> {
    // Handle built-in commands
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

    // Execute external command
    this.appendOutput(`${chalk.green('$')} ${command}\n`);
    
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
      
      // Offer AI help for errors
      this.appendOutput(chalk.yellow('Tip: Press Ctrl+A to enable AI mode for help with this error\n'));
    }
    
    this.appendOutput('\n');
    await this.updateHistorySidebar();
  }

  private async handleAIInput(input: string): Promise<void> {
    this.appendOutput(`${chalk.cyan('AI>')} ${input}\n`);
    
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
  }

  private appendOutput(text: string): void {
    const currentContent = this.outputBox.getContent();
    this.outputBox.setContent(currentContent + text);
    this.outputBox.setScrollPerc(100);
  }

  private updateStatus(): void {
    this.statusBar.setContent(this.getStatusContent());
  }

  private getStatusContent(): string {
    const mode = this.aiMode ? chalk.cyan(' AI Mode ') : chalk.green(' Shell Mode ');
    const dir = chalk.white(` ${this.executor.getCurrentDirectory()} `);
    const help = chalk.yellow(' Ctrl+A: Toggle AI | Ctrl+L: Clear | Ctrl+C: Exit ');
    
    return `${mode}${dir}${help}`;
  }

  private async loadRecentHistory(): Promise<void> {
    const recent = await this.historyManager.search({ limit: 50 });
    this.updateHistorySidebar(recent);
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
    this.historyManager.close();
  }

  start(): void {
    this.screen.render();
  }
}