import Anthropic from '@anthropic-ai/sdk';
import { AIRequest, AIResponse, CommandResult } from '../../shared/types.js';

export class AIAssistant {
  private client: Anthropic;
  private model: string = 'claude-3-opus-20240229';

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  async processRequest(request: AIRequest): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(request.type);
      const userMessage = this.buildUserMessage(request);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      return this.parseResponse(response.content[0].text, request.type);
    } catch (error) {
      return {
        type: 'chat',
        content: `Error: ${error.message}`,
      };
    }
  }

  private buildSystemPrompt(type: AIRequest['type']): string {
    const basePrompt = `You are Shellington, an AI assistant integrated into a powerful shell application. 
    You help users with command-line tasks, explain commands, and provide intelligent assistance.`;

    switch (type) {
      case 'natural-to-command':
        return `${basePrompt}
        Convert natural language queries into executable shell commands.
        Provide the most appropriate command for the user's request.
        If multiple commands are needed, provide them in sequence.
        Always prioritize safety and ask for confirmation for destructive operations.`;

      case 'error-analysis':
        return `${basePrompt}
        Analyze command errors and provide helpful solutions.
        Explain what went wrong and suggest fixes.
        Consider common issues like permissions, missing dependencies, or syntax errors.`;

      case 'explain':
        return `${basePrompt}
        Explain shell commands in simple, clear language.
        Break down complex commands into their components.
        Describe what each part does and the overall effect.`;

      case 'chat':
        return `${basePrompt}
        Engage in helpful conversation about shell-related topics.
        Provide guidance, tips, and best practices.
        Be friendly and informative.`;
    }
  }

  private buildUserMessage(request: AIRequest): string {
    let message = request.query;

    if (request.context) {
      if (request.context.lastCommand) {
        message += `\n\nLast command executed:\n${this.formatCommandResult(request.context.lastCommand)}`;
      }

      if (request.context.workingDirectory) {
        message += `\n\nCurrent directory: ${request.context.workingDirectory}`;
      }
    }

    return message;
  }

  private formatCommandResult(result: CommandResult): string {
    return `Command: ${result.command}
Exit code: ${result.exitCode}
${result.stdout ? `Output:\n${result.stdout}` : ''}
${result.stderr ? `Errors:\n${result.stderr}` : ''}`;
  }

  private parseResponse(text: string, requestType: AIRequest['type']): AIResponse {
    if (requestType === 'natural-to-command') {
      const commandMatch = text.match(/```(?:bash|sh)?\n([\s\S]*?)\n```/);
      if (commandMatch) {
        return {
          type: 'command',
          content: text,
          command: commandMatch[1].trim(),
          confidence: 0.9,
        };
      }
    }

    const typeMap: Record<AIRequest['type'], AIResponse['type']> = {
      'natural-to-command': 'command',
      'error-analysis': 'suggestion',
      'explain': 'explanation',
      'chat': 'chat',
    };

    return {
      type: typeMap[requestType],
      content: text,
    };
  }

  async suggestCommand(description: string): Promise<string | null> {
    const response = await this.processRequest({
      type: 'natural-to-command',
      query: description,
    });

    return response.command || null;
  }

  async analyzeError(lastCommand: CommandResult): Promise<string> {
    const response = await this.processRequest({
      type: 'error-analysis',
      query: 'Please analyze this command error and suggest a fix.',
      context: { lastCommand },
    });

    return response.content;
  }

  async explainCommand(command: string): Promise<string> {
    const response = await this.processRequest({
      type: 'explain',
      query: `Please explain this command: ${command}`,
    });

    return response.content;
  }
}