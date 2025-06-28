import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { CommandExecutor } from '../shell/executor.js';
import { HistoryManager } from '../history/manager.js';
import { AIAssistant } from '../ai/assistant.js';
import { RemoteCommand, RemoteCommandResult, AuthToken } from '../../shared/types.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'shellington-api.log' }),
  ],
});

export class APIServer {
  private app: express.Application;
  private httpServer: any;
  private io: SocketIOServer;
  private executor: CommandExecutor;
  private historyManager: HistoryManager;
  private aiAssistant: AIAssistant;
  private jwtSecret: string;
  private activeSessions: Map<string, { executor: CommandExecutor; userId: string }>;

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: process.env.SHELLINGTON_UI_URL || 'http://localhost:3000',
        credentials: true,
      },
    });
    
    this.executor = new CommandExecutor();
    this.historyManager = new HistoryManager();
    this.aiAssistant = new AIAssistant();
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
    this.activeSessions = new Map();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', process.env.SHELLINGTON_UI_URL || 'http://localhost:3000');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });

    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const decoded = jwt.verify(token, this.jwtSecret) as any;
        socket.data.userId = decoded.userId;
        socket.data.permissions = decoded.permissions;
        next();
      } catch (err) {
        next(new Error('Invalid token'));
      }
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', version: '1.0.0' });
    });

    // Authentication endpoint
    this.app.post('/auth/token', async (req, res) => {
      const { apiKey } = req.body;
      
      // In production, validate against stored API keys
      if (!apiKey || apiKey.length < 32) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const token = jwt.sign(
        {
          userId: 'user-' + crypto.randomBytes(8).toString('hex'),
          permissions: ['execute', 'history', 'ai'],
        },
        this.jwtSecret,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    });

    // History endpoints
    this.app.get('/api/history', this.authenticateRequest, async (req, res) => {
      const options = {
        keyword: req.query.keyword as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const results = await this.historyManager.search(options);
      res.json(results);
    });

    this.app.get('/api/history/stats', this.authenticateRequest, async (req, res) => {
      const stats = await this.historyManager.getStatistics();
      res.json(stats);
    });
  }

  private authenticateRequest(req: any, res: any, next: any): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}, userId: ${socket.data.userId}`);

      // Create a session-specific executor
      const sessionExecutor = new CommandExecutor();
      this.activeSessions.set(socket.id, {
        executor: sessionExecutor,
        userId: socket.data.userId,
      });

      // Handle command execution
      socket.on('execute', async (command: RemoteCommand, callback) => {
        const session = this.activeSessions.get(socket.id);
        if (!session) {
          return callback({ error: 'Session not found' });
        }

        if (!this.hasPermission(socket.data.permissions, 'execute')) {
          return callback({ error: 'Permission denied' });
        }

        logger.info(`Executing command for ${session.userId}: ${command.command}`);

        try {
          // Change directory if specified
          if (command.workingDirectory) {
            session.executor.changeDirectory(command.workingDirectory);
          }

          // Set environment variables if specified
          if (command.environment) {
            Object.entries(command.environment).forEach(([key, value]) => {
              session.executor.setEnvironment(key, value);
            });
          }

          // Execute the command
          const result = await session.executor.execute(command.command);
          
          // Save to history
          await this.historyManager.addEntry(result);

          const response: RemoteCommandResult = {
            ...result,
            commandId: command.id,
          };

          callback({ result: response });

          // Emit real-time output updates
          socket.emit('output', {
            commandId: command.id,
            type: 'complete',
            data: result,
          });
        } catch (error) {
          logger.error(`Command execution error: ${error.message}`);
          callback({ error: error.message });
        }
      });

      // Handle AI requests
      socket.on('ai', async (request, callback) => {
        if (!this.hasPermission(socket.data.permissions, 'ai')) {
          return callback({ error: 'Permission denied' });
        }

        try {
          const response = await this.aiAssistant.processRequest(request);
          callback({ response });
        } catch (error) {
          logger.error(`AI request error: ${error.message}`);
          callback({ error: error.message });
        }
      });

      // Handle directory changes
      socket.on('cd', async (path: string, callback) => {
        const session = this.activeSessions.get(socket.id);
        if (!session) {
          return callback({ error: 'Session not found' });
        }

        try {
          session.executor.changeDirectory(path);
          callback({ 
            success: true, 
            cwd: session.executor.getCurrentDirectory() 
          });
        } catch (error) {
          callback({ error: error.message });
        }
      });

      // Handle environment info requests
      socket.on('env', (callback) => {
        const session = this.activeSessions.get(socket.id);
        if (!session) {
          return callback({ error: 'Session not found' });
        }

        callback({
          cwd: session.executor.getCurrentDirectory(),
          env: session.executor.getEnvironment(),
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.activeSessions.delete(socket.id);
      });
    });
  }

  private hasPermission(permissions: string[], required: string): boolean {
    return permissions.includes(required) || permissions.includes('*');
  }

  async start(port: number = 3001, host: string = 'localhost'): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(port, host, () => {
        logger.info(`Shellington API server listening on ${host}:${port}`);
        console.log(`\nShellington API server started on http://${host}:${port}`);
        console.log('Waiting for UI connections...\n');
        resolve();
      });
    });
  }

  stop(): void {
    this.httpServer.close();
    this.historyManager.close();
  }
}

export async function startAPIServer(port: number, host: string): Promise<void> {
  const server = new APIServer();
  await server.start(port, host);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down API server...');
    server.stop();
    process.exit(0);
  });
}