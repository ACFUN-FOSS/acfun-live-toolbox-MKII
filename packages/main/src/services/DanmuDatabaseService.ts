import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { logger } from '@app/utils/logger';

// 弹幕数据库服务 - 处理弹幕的持久化存储
export class DanmuDatabaseService {
  private static instance: DanmuDatabaseService;
  private db: Database.Database;
  private dbPath: string;

  private constructor() {
    // 初始化数据库路径
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'danmu.db');
    this.db = this.initDatabase();
  }

  // 单例模式获取实例
  public static getInstance(): DanmuDatabaseService {
    if (!DanmuDatabaseService.instance) {
      DanmuDatabaseService.instance = new DanmuDatabaseService();
    }
    return DanmuDatabaseService.instance;
  }

  // 初始化数据库连接并创建表
  private initDatabase(): Database.Database {
    try {
      // 确保目录存在
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 连接数据库
      const db = new Database(this.dbPath);

      // 创建弹幕表
      db.exec(`
        CREATE TABLE IF NOT EXISTS danmu (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          roomId INTEGER NOT NULL,
          userId TEXT NOT NULL,
          username TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          type TEXT NOT NULL,
          color TEXT,
          fontSize INTEGER,
          isGift BOOLEAN DEFAULT FALSE,
          giftValue INTEGER DEFAULT 0
        );

        // 创建索引提升查询性能
        CREATE INDEX IF NOT EXISTS idx_danmu_roomId ON danmu(roomId);
        CREATE INDEX IF NOT EXISTS idx_danmu_timestamp ON danmu(timestamp);
      `);

      return db;
    } catch (error) {
      logger.error('Failed to initialize danmu database:', error);
      throw new Error('弹幕数据库初始化失败');
    }
  }

  // 插入新弹幕
  public insertDanmu(danmu: {
    roomId: number;
    userId: string;
    username: string;
    content: string;
    type: string;
    color?: string;
    fontSize?: number;
    isGift?: boolean;
    giftValue?: number;
  }): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO danmu (
          roomId, userId, username, content, type, color, fontSize, isGift, giftValue
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        danmu.roomId,
        danmu.userId,
        danmu.username,
        danmu.content,
        danmu.type,
        danmu.color || null,
        danmu.fontSize || null,
        danmu.isGift ? 1 : 0,
        danmu.giftValue || 0
      );
    } catch (error) {
      logger.error('Failed to insert danmu:', error);
      throw new Error('保存弹幕失败');
    }
  }

  // 批量插入弹幕
  public bulkInsertDanmu(danmus: Array<{
    roomId: number;
    userId: string;
    username: string;
    content: string;
    type: string;
    color?: string;
    fontSize?: number;
    isGift?: boolean;
    giftValue?: number;
  }>): void {
    const transaction = this.db.transaction((items) => {
      for (const item of items) {
        this.insertDanmu(item);
      }
    });

    try {
      transaction(danmus);
    } catch (error) {
      logger.error('Failed to bulk insert danmu:', error);
      throw new Error('批量保存弹幕失败');
    }
  }

  // 查询指定房间的弹幕
  public getDanmuByRoomId(roomId: number, limit: number = 100, offset: number = 0): Array<any> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM danmu
        WHERE roomId = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `);

      return stmt.all(roomId, limit, offset);
    } catch (error) {
      logger.error('Failed to query danmu by roomId:', error);
      throw new Error('查询弹幕失败');
    }
  }

  // 查询指定时间范围内的弹幕
  public getDanmuByTimeRange(
    roomId: number,
    startTime: Date,
    endTime: Date
  ): Array<any> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM danmu
        WHERE roomId = ?
        AND timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
      `);

      return stmt.all(roomId, startTime.toISOString(), endTime.toISOString());
    } catch (error) {
      logger.error('Failed to query danmu by time range:', error);
      throw new Error('查询时间范围内弹幕失败');
    }
  }

  // 关闭数据库连接
  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  // 执行查询并返回结果
  public executeQuery(sql: string, params: any[] = []): any[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('Failed to execute query:', error);
      throw new Error('执行数据库查询失败');
    }
  }

  // 执行单行查询并返回结果
  public getSingleResult(sql: string, params: any[] = []): any {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params);
    } catch (error) {
      console.error('Failed to get single result:', error);
      throw new Error('获取单行查询结果失败');
    }
  }
}