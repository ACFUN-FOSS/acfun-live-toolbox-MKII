import * as sqlite3 from 'sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as os from 'os';

export class DatabaseManager {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor(customDbPath?: string) {
    if (customDbPath) {
      this.dbPath = customDbPath;
    } else if (process.env.ACFUN_TEST_DB_PATH) {
      // 测试环境使用环境变量指定的路径
      this.dbPath = process.env.ACFUN_TEST_DB_PATH;
    } else {
      try {
        // 将数据库文件存储在用户数据目录中
        const userDataPath = app.getPath('userData');
        this.dbPath = path.join(userDataPath, 'events.db');
      } catch (error) {
        // 如果 app.getPath 失败（比如在测试环境中），使用临时目录
        console.warn('Failed to get userData path, using temp directory:', error);
        this.dbPath = path.join(os.tmpdir(), 'acfun-events.db');
      }
    }
  }

  public async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err: Error | null) => {
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
          source TEXT DEFAULT 'unknown',
          user_id TEXT,
          username TEXT,
          payload TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          received_at INTEGER,
          raw_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // 房间元数据：用于根据主播用户名关键词解析 room_kw 到 room_id 集合
      const createRoomsMetaTableSql = `
        CREATE TABLE IF NOT EXISTS rooms_meta (
          room_id TEXT PRIMARY KEY,
          streamer_name TEXT,
          streamer_user_id TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `;

      const createIndexesSql = [
        'CREATE INDEX IF NOT EXISTS idx_events_room_ts ON events (room_id, timestamp);',
        'CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events (type, timestamp);',
        'CREATE INDEX IF NOT EXISTS idx_events_source ON events (source);',
        'CREATE INDEX IF NOT EXISTS idx_events_received_at ON events (received_at);',
        'CREATE INDEX IF NOT EXISTS idx_rooms_meta_streamer_name ON rooms_meta (streamer_name)'
      ];

      // 检查并添加新列的迁移逻辑
      const migrationSql = [
        'ALTER TABLE events ADD COLUMN source TEXT DEFAULT \'unknown\';',
        'ALTER TABLE events ADD COLUMN received_at INTEGER;'
      ];

      this.db.serialize(() => {
        this.db!.run(createEventsTableSql, (err: Error | null) => {
          if (err) {
            console.error('Error creating events table:', err.message);
            reject(err);
            return;
          }

          // 创建房间元数据表
          this.db!.run(createRoomsMetaTableSql, (roomsErr: Error | null) => {
            if (roomsErr) {
              console.error('Error creating rooms_meta table:', roomsErr.message);
              reject(roomsErr);
              return;
            }

          // 执行迁移（如果列不存在）
          migrationSql.forEach(sql => {
            this.db!.run(sql, (migErr: Error | null) => {
              // 忽略列已存在的错误
              if (migErr && !migErr.message.includes('duplicate column name')) {
                console.warn('Migration warning:', migErr.message);
              }
            });
          });

          let indexCreationError: Error | null = null;
          for (const stmt of createIndexesSql) {
            this.db!.run(stmt, (idxErr: Error | null) => {
              if (idxErr && !indexCreationError) {
                indexCreationError = idxErr;
              }
            });
          }

          if (indexCreationError) {
            console.error('Error creating indexes:', indexCreationError);
            reject(indexCreationError);
          } else {
            console.log('Events table and indexes created/verified');
            resolve();
          }
          });
        });
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

      this.db.close((err: Error | null) => {
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

      this.db.run('VACUUM', (err: Error | null) => {
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
