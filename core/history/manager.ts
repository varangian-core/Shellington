import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { CommandResult, CommandHistoryEntry } from '../../shared/types.js';

export class HistoryManager {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    const defaultPath = path.join(os.homedir(), '.shellington', 'history.db');
    this.dbPath = dbPath || defaultPath;
    
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.db = new sqlite3.Database(this.dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS command_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          command TEXT NOT NULL,
          exit_code INTEGER NOT NULL,
          stdout TEXT,
          stderr TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          working_directory TEXT NOT NULL,
          user TEXT NOT NULL,
          duration INTEGER NOT NULL
        )
      `);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON command_history(timestamp)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_exit_code ON command_history(exit_code)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_user ON command_history(user)`);
    });
  }

  addEntry(result: CommandResult): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO command_history 
        (command, exit_code, stdout, stderr, timestamp, working_directory, user, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        result.command,
        result.exitCode,
        result.stdout,
        result.stderr,
        result.timestamp.toISOString(),
        result.workingDirectory,
        result.user,
        result.duration,
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );

      stmt.finalize();
    });
  }

  search(options: {
    keyword?: string;
    startDate?: Date;
    endDate?: Date;
    exitCode?: number;
    user?: string;
    limit?: number;
    offset?: number;
  }): Promise<CommandHistoryEntry[]> {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM command_history WHERE 1=1';
      const params: any[] = [];

      if (options.keyword) {
        query += ' AND command LIKE ?';
        params.push(`%${options.keyword}%`);
      }

      if (options.startDate) {
        query += ' AND timestamp >= ?';
        params.push(options.startDate.toISOString());
      }

      if (options.endDate) {
        query += ' AND timestamp <= ?';
        params.push(options.endDate.toISOString());
      }

      if (options.exitCode !== undefined) {
        query += ' AND exit_code = ?';
        params.push(options.exitCode);
      }

      if (options.user) {
        query += ' AND user = ?';
        params.push(options.user);
      }

      query += ' ORDER BY timestamp DESC';

      if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
        
        if (options.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const entries = rows.map((row: any) => ({
            id: row.id,
            command: row.command,
            exitCode: row.exit_code,
            stdout: row.stdout,
            stderr: row.stderr,
            timestamp: new Date(row.timestamp),
            workingDirectory: row.working_directory,
            user: row.user,
            duration: row.duration,
          }));
          resolve(entries);
        }
      });
    });
  }

  getLastCommand(): Promise<CommandHistoryEntry | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM command_history ORDER BY timestamp DESC LIMIT 1`,
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              command: row.command,
              exitCode: row.exit_code,
              stdout: row.stdout,
              stderr: row.stderr,
              timestamp: new Date(row.timestamp),
              workingDirectory: row.working_directory,
              user: row.user,
              duration: row.duration,
            });
          }
        }
      );
    });
  }

  getStatistics(): Promise<{
    totalCommands: number;
    successfulCommands: number;
    failedCommands: number;
    mostUsedCommands: { command: string; count: number }[];
  }> {
    return new Promise((resolve, reject) => {
      const stats: any = {};

      this.db.serialize(() => {
        this.db.get('SELECT COUNT(*) as count FROM command_history', (err, row: any) => {
          if (err) return reject(err);
          stats.totalCommands = row.count;
        });

        this.db.get('SELECT COUNT(*) as count FROM command_history WHERE exit_code = 0', (err, row: any) => {
          if (err) return reject(err);
          stats.successfulCommands = row.count;
        });

        this.db.all(
          `SELECT command, COUNT(*) as count 
           FROM command_history 
           GROUP BY command 
           ORDER BY count DESC 
           LIMIT 10`,
          (err, rows: any[]) => {
            if (err) return reject(err);
            stats.failedCommands = stats.totalCommands - stats.successfulCommands;
            stats.mostUsedCommands = rows;
            resolve(stats);
          }
        );
      });
    });
  }

  close(): void {
    this.db.close();
  }
}