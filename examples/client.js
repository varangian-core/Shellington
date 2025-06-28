#!/usr/bin/env node

/**
 * Example Shellington API Client
 * 
 * This demonstrates how to connect to the Shellington API server
 * and execute commands remotely.
 * 
 * Usage:
 *   1. Start the server: npm run dev:server
 *   2. Run this client: node examples/client.js
 */

import { io } from 'socket.io-client';
import axios from 'axios';
import readline from 'readline';

const API_URL = process.env.SHELLINGTON_API_URL || 'http://localhost:3001';
const API_KEY = process.env.SHELLINGTON_API_KEY || 'demo-api-key-min-32-characters-long';

class ShellingtonClient {
  constructor() {
    this.token = null;
    this.socket = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'shellington> '
    });
  }

  async connect() {
    try {
      // Get authentication token
      console.log('🔐 Authenticating...');
      const authResponse = await axios.post(`${API_URL}/auth/token`, {
        apiKey: API_KEY
      });
      
      this.token = authResponse.data.token;
      console.log('✅ Authentication successful');

      // Connect WebSocket
      console.log('🔌 Connecting to Shellington server...');
      this.socket = io(API_URL, {
        auth: { token: this.token },
        transports: ['websocket']
      });

      return new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          console.log('✅ Connected to Shellington server');
          console.log('💡 Type commands or "help" for assistance\n');
          resolve();
        });

        this.socket.on('error', (error) => {
          console.error('❌ Connection error:', error);
          reject(error);
        });

        this.socket.on('disconnect', () => {
          console.log('\n⚠️  Disconnected from server');
          process.exit(0);
        });
      });
    } catch (error) {
      console.error('❌ Failed to connect:', error.message);
      throw error;
    }
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      const commandId = Date.now().toString();
      
      this.socket.emit('execute', {
        id: commandId,
        command: command,
        timestamp: new Date()
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.result);
        }
      });

      // Listen for real-time output
      const outputHandler = (data) => {
        if (data.commandId === commandId) {
          if (data.type === 'stdout') {
            process.stdout.write(data.data);
          } else if (data.type === 'stderr') {
            process.stderr.write(data.data);
          }
        }
      };

      this.socket.on('output', outputHandler);
      
      // Clean up listener after command completes
      setTimeout(() => {
        this.socket.off('output', outputHandler);
      }, 30000); // 30 second timeout
    });
  }

  async askAI(query) {
    return new Promise((resolve, reject) => {
      this.socket.emit('ai', {
        type: 'chat',
        query: query
      }, (response) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.response);
        }
      });
    });
  }

  async getHistory(limit = 10) {
    try {
      const response = await axios.get(`${API_URL}/api/history`, {
        params: { limit },
        headers: { Authorization: `Bearer ${this.token}` }
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get history: ${error.message}`);
    }
  }

  startREPL() {
    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const command = line.trim();

      if (!command) {
        this.rl.prompt();
        return;
      }

      try {
        switch (command) {
          case 'help':
            this.showHelp();
            break;
          
          case 'history':
            const history = await this.getHistory();
            console.log('\n📜 Recent Commands:');
            history.forEach(entry => {
              const status = entry.exitCode === 0 ? '✅' : '❌';
              console.log(`${status} ${entry.command}`);
            });
            console.log();
            break;
          
          case 'exit':
          case 'quit':
            console.log('👋 Goodbye!');
            this.socket.disconnect();
            process.exit(0);
            break;
          
          default:
            if (command.startsWith('ai ')) {
              const query = command.substring(3);
              console.log('\n🤖 AI Assistant:');
              const response = await this.askAI(query);
              console.log(response.content);
              console.log();
            } else {
              const result = await this.executeCommand(command);
              if (result.exitCode !== 0) {
                console.log(`\n⚠️  Command exited with code ${result.exitCode}`);
              }
            }
            break;
        }
      } catch (error) {
        console.error(`\n❌ Error: ${error.message}\n`);
      }

      this.rl.prompt();
    });
  }

  showHelp() {
    console.log(`
🐚 Shellington Remote Client

Commands:
  help              Show this help message
  history           Show recent command history
  ai <query>        Ask the AI assistant
  exit/quit         Disconnect and exit
  
Any other input will be executed as a shell command.

Examples:
  ls -la            List files in current directory
  ai how do I find large files?
  history           Show your command history
`);
  }
}

// Main execution
async function main() {
  console.log('🐚 Shellington Remote Client v1.0');
  console.log('================================\n');

  const client = new ShellingtonClient();
  
  try {
    await client.connect();
    client.startREPL();
  } catch (error) {
    console.error('Failed to start client:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down...');
  process.exit(0);
});

main();