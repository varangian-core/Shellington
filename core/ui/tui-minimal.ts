import blessed from 'blessed';
import { CommandExecutor } from '../shell/executor.js';
import { HistoryManager } from '../history/manager.js';
import { AIAssistant } from '../ai/assistant.js';
import chalk from 'chalk';

export class TUI {
  private screen: blessed.Widgets.Screen;
  private outputBox: blessed.Widgets.BoxElement;
  private inputLine: blessed.Widgets.TextElement;
  private promptBox: blessed.Widgets.BoxElement;
  
  private executor: CommandExecutor;
  private historyManager: HistoryManager;
  private aiAssistant: AIAssistant;
  
  private commandHistory: string[] = [];
  private historyIndex: number = -1;
  private aiMode: boolean = false;
  private currentInput: string = '';
  private cursorPos: number = 0;

  constructor() {
    this.executor = new CommandExecutor();
    this.historyManager = new HistoryManager();
    this.aiAssistant = new AIAssistant();
    
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Shellington - Minimal TUI',
      fullUnicode: true,
    });

    this.setupUI();
    this.setupKeybindings();
  }

  private setupUI(): void {
    // Main output area
    this.outputBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: '100%-3',
      content: chalk.green('Welcome to Shellington (Minimal Mode)!\n'),
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'cyan',
        },
      },
      label: ' Output ',
    });

    // Prompt line
    this.promptBox = blessed.box({
      bottom: 1,
      left: 0,
      width: '100%',
      height: 1,
      content: this.getPrompt(),
      tags: true,
    });

    // Input display
    this.inputLine = blessed.text({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      style: {
        bg: 'black',
        fg: 'white',
      },
    });

    this.screen.append(this.outputBox);
    this.screen.append(this.promptBox);
    this.screen.append(this.inputLine);

    this.screen.render();
  }

  private getPrompt(): string {
    const mode = this.aiMode ? chalk.cyan('[AI] ') : '';
    return `${mode}${chalk.green('$')} `;
  }

  private setupKeybindings(): void {
    // Character input
    this.screen.on('keypress', (ch, key) => {
      if (!key) return;

      // Handle special keys
      if (key.ctrl) {
        this.handleCtrlKey(key);
        return;
      }

      switch (key.name) {
        case 'return':
        case 'enter':
          this.handleEnter();
          break;
        case 'backspace':
          this.handleBackspace();
          break;
        case 'up':
          this.navigateHistory(-1);
          break;
        case 'down':
          this.navigateHistory(1);
          break;
        case 'left':
          if (this.cursorPos > 0) this.cursorPos--;
          this.updateInputDisplay();
          break;
        case 'right':
          if (this.cursorPos < this.currentInput.length) this.cursorPos++;
          this.updateInputDisplay();
          break;
        default:
          // Regular character input
          if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
            this.currentInput = 
              this.currentInput.slice(0, this.cursorPos) + 
              ch + 
              this.currentInput.slice(this.cursorPos);
            this.cursorPos++;
            this.updateInputDisplay();
          }
      }
    });
  }

  private handleCtrlKey(key: any): void {
    switch (key.name) {
      case 'c':
        this.appendOutput(chalk.yellow('\nUse "exit" to quit\n'));
        this.currentInput = '';
        this.cursorPos = 0;
        this.updateInputDisplay();
        break;
      case 'l':
        this.outputBox.setContent('');
        this.screen.render();
        break;
      case 'u':
        this.currentInput = '';
        this.cursorPos = 0;
        this.updateInputDisplay();
        break;
      case 'a':
        this.aiMode = !this.aiMode;
        this.promptBox.setContent(this.getPrompt());
        this.screen.render();
        break;
      case 'd':
        this.cleanup();
        process.exit(0);
        break;
    }
  }

  private handleBackspace(): void {
    if (this.cursorPos > 0) {
      this.currentInput = 
        this.currentInput.slice(0, this.cursorPos - 1) + 
        this.currentInput.slice(this.cursorPos);
      this.cursorPos--;
      this.updateInputDisplay();
    }
  }

  private async handleEnter(): Promise<void> {
    const command = this.currentInput.trim();
    if (!command) {
      this.currentInput = '';
      this.cursorPos = 0;
      this.updateInputDisplay();
      return;
    }

    // Add to history
    this.commandHistory.push(command);
    this.historyIndex = -1;

    // Clear input
    this.currentInput = '';
    this.cursorPos = 0;
    this.updateInputDisplay();

    // Display command
    this.appendOutput(`${this.getPrompt()}${command}\n`);

    // Handle built-in commands
    if (command === 'exit' || command === 'quit') {
      this.cleanup();
      process.exit(0);
    }

    if (command === 'clear') {
      this.outputBox.setContent('');
      this.screen.render();
      return;
    }

    if (command === 'help') {
      this.showHelp();
      return;
    }

    // Execute command
    try {
      if (this.aiMode) {
        await this.handleAICommand(command);
      } else {
        await this.executeCommand(command);
      }
    } catch (error) {
      this.appendOutput(chalk.red(`Error: ${error.message}\n`));
    }
  }

  private async executeCommand(command: string): Promise<void> {
    if (command.startsWith('cd ')) {
      const dir = command.substring(3).trim();
      try {
        this.executor.changeDirectory(dir);
        this.appendOutput(chalk.blue(`Changed to: ${this.executor.getCurrentDirectory()}\n`));
      } catch (error) {
        this.appendOutput(chalk.red(`Error: ${error.message}\n`));
      }
      return;
    }

    const result = await this.executor.execute(command);
    await this.historyManager.addEntry(result);

    if (result.stdout) {
      this.appendOutput(result.stdout);
    }
    if (result.stderr) {
      this.appendOutput(chalk.red(result.stderr));
    }
    if (result.exitCode !== 0) {
      this.appendOutput(chalk.red(`Exit code: ${result.exitCode}\n`));
    }
  }

  private async handleAICommand(input: string): Promise<void> {
    try {
      const response = await this.aiAssistant.processRequest({
        type: 'chat',
        query: input,
        context: {
          workingDirectory: this.executor.getCurrentDirectory(),
        },
      });
      this.appendOutput(chalk.cyan(`AI: ${response.content}\n`));
    } catch (error) {
      this.appendOutput(chalk.red(`AI Error: ${error.message}\n`));
    }
  }

  private navigateHistory(direction: number): void {
    if (direction === -1 && this.historyIndex < this.commandHistory.length - 1) {
      this.historyIndex++;
      this.currentInput = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
      this.cursorPos = this.currentInput.length;
      this.updateInputDisplay();
    } else if (direction === 1 && this.historyIndex > -1) {
      this.historyIndex--;
      if (this.historyIndex === -1) {
        this.currentInput = '';
      } else {
        this.currentInput = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
      }
      this.cursorPos = this.currentInput.length;
      this.updateInputDisplay();
    }
  }

  private updateInputDisplay(): void {
    // Show current input with a simple cursor
    const display = this.currentInput.slice(0, this.cursorPos) + 
                   chalk.inverse(' ') + 
                   this.currentInput.slice(this.cursorPos);
    this.inputLine.setContent(display);
    this.screen.render();
  }

  private appendOutput(text: string): void {
    const current = this.outputBox.getContent();
    this.outputBox.setContent(current + text);
    this.outputBox.setScrollPerc(100);
    this.screen.render();
  }

  private showHelp(): void {
    this.appendOutput(chalk.bold('\nShellington Help:\n'));
    this.appendOutput('Commands: help, clear, exit\n');
    this.appendOutput('Ctrl+A: Toggle AI mode\n');
    this.appendOutput('Ctrl+L: Clear screen\n');
    this.appendOutput('Ctrl+U: Clear input\n');
    this.appendOutput('Ctrl+C: Cancel\n');
    this.appendOutput('Ctrl+D: Force exit\n\n');
  }

  private cleanup(): void {
    this.historyManager.close();
    this.screen.destroy();
  }

  start(): void {
    this.screen.render();
    this.updateInputDisplay();
  }
}