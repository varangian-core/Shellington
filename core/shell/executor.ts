import { spawn, SpawnOptions } from 'child_process';
import { CommandResult } from '../../shared/types.js';
import os from 'os';
import path from 'path';

export class CommandExecutor {
  private cwd: string;
  private env: NodeJS.ProcessEnv;

  constructor() {
    this.cwd = process.cwd();
    this.env = { ...process.env };
  }

  async execute(command: string): Promise<CommandResult> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
      const shellFlag = process.platform === 'win32' ? '/c' : '-c';
      
      // Disable Ghostty shell integration to prevent command echoing
      const cleanEnv = { ...this.env };
      delete cleanEnv.GHOSTTY_SHELL_INTEGRATION_NO_SUDO;
      delete cleanEnv.GHOSTTY_RESOURCES_DIR;
      delete cleanEnv.GHOSTTY_BIN_DIR;
      
      const options: SpawnOptions = {
        cwd: this.cwd,
        env: cleanEnv,
        shell: false,
      };

      const child = spawn(shell, [shellFlag, command], options);
      
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Don't write directly - let the UI handle display
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
        // Don't write directly - let the UI handle display
      });

      child.on('close', (code) => {
        const result: CommandResult = {
          command,
          exitCode: code || 0,
          stdout,
          stderr,
          timestamp: new Date(),
          workingDirectory: this.cwd,
          user: os.userInfo().username,
          duration: Date.now() - startTime,
        };
        
        resolve(result);
      });

      child.on('error', (error) => {
        const result: CommandResult = {
          command,
          exitCode: -1,
          stdout,
          stderr: stderr + '\n' + error.message,
          timestamp: new Date(),
          workingDirectory: this.cwd,
          user: os.userInfo().username,
          duration: Date.now() - startTime,
        };
        
        resolve(result);
      });
    });
  }

  changeDirectory(newPath: string): void {
    const resolvedPath = path.resolve(this.cwd, newPath);
    this.cwd = resolvedPath;
    process.chdir(resolvedPath);
  }

  setEnvironment(key: string, value: string): void {
    this.env[key] = value;
    process.env[key] = value;
  }

  getCurrentDirectory(): string {
    return this.cwd;
  }

  getEnvironment(): NodeJS.ProcessEnv {
    return { ...this.env };
  }
}