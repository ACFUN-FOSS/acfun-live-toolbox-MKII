import sqlite3 from 'sqlite3';
import { app } from 'electron';
import path from 'path';

export class DatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    // 将数据库文件存储在用户数据目录中
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'events.db');
  }

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Database connected at:', this.dbPath);
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const createEventsTableSql = `
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT,
          type TEXT NOT NULL,
          room_id TEXT NOT NULL,
          user_id TEXT,
          username TEXT,
          payload TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          raw_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_room_id (room_id),
          INDEX idx_type (type),
          INDEX idx_timestamp (timestamp)
        );
      `;

      this.db.run(createEventsTableSql, (err) => {
        if (err) {
          console.error('Error creating events table:', err.message);
          reject(err);
        } else {
          console.log('Events table created/verified');
          resolve();
        }
      });
    });
  }

  public getDb(): sqlite3.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
          reject(err);
        } else {
          console.log('Database connection closed');
          this.db = null;
          resolve();
        }
      });
    });
  }

  public async vacuum(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run('VACUUM', (err) => {
        if (err) {
          console.error('Error vacuuming database:', err.message);
          reject(err);
        } else {
          console.log('Database vacuumed successfully');
          resolve();
        }
      });
    });
  }
}
