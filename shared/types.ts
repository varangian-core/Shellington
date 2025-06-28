export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timestamp: Date;
  workingDirectory: string;
  user: string;
  duration: number;
}

export interface CommandHistoryEntry extends CommandResult {
  id: number;
}

export interface AIRequest {
  type: 'natural-to-command' | 'error-analysis' | 'explain' | 'chat';
  query: string;
  context?: {
    lastCommand?: CommandResult;
    workingDirectory?: string;
    history?: CommandHistoryEntry[];
  };
}

export interface AIResponse {
  type: 'command' | 'explanation' | 'suggestion' | 'chat';
  content: string;
  command?: string;
  confidence?: number;
}

export interface RemoteCommand {
  id: string;
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timestamp: Date;
}

export interface RemoteCommandResult extends CommandResult {
  commandId: string;
}

export interface AuthToken {
  token: string;
  expiresAt: Date;
  permissions: string[];
}