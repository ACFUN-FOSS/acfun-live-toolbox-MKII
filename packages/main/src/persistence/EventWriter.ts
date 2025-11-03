import { DatabaseManager } from './DatabaseManager';
import { NormalizedEvent, EventBatch } from '../types';

export class EventWriter {
  private queue: NormalizedEvent[] = [];
  private databaseManager: DatabaseManager;
  private isWriting = false;
  private batchSize = 100;
  private flushInterval = 1000; // 1 second
  private maxQueueSize = 10000;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
    this.startFlushTimer();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushQueue().catch((err: any) => {
        console.error('Error in scheduled flush:', err);
      });
    }, this.flushInterval);
  }

  public enqueue(event: NormalizedEvent): void {
    // 防止队列过大导致内存问题
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Event queue is full, dropping oldest events');
      this.queue = this.queue.slice(-this.maxQueueSize / 2);
    }

    this.queue.push({
      ...event,
      ts: event.ts || Date.now()
    });

    // 如果队列达到批处理大小，立即刷新
    if (this.queue.length >= this.batchSize) {
      this.flushQueue().catch((err: any) => {
        console.error('Error in immediate flush:', err);
      });
    }
  }

  public async flushQueue(): Promise<void> {
    if (this.isWriting || this.queue.length === 0) {
      return;
    }

    this.isWriting = true;
    const eventsToWrite = this.queue.splice(0, this.batchSize);

    try {
      await this.writeBatch(eventsToWrite);
    } catch (error: any) {
      console.error('Error writing event batch:', error);
      // 将失败的事件重新加入队列头部
      this.queue.unshift(...eventsToWrite);
    } finally {
      this.isWriting = false;
    }
  }

  private async writeBatch(events: NormalizedEvent[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseManager.getDb();
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        const stmt = db.prepare(`
          INSERT INTO events (
            event_id, type, room_id, source, user_id, username, 
            payload, timestamp, received_at, raw_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let errorOccurred = false;

        events.forEach(event => {
          stmt.run(
            null, // id 字段，数据库自动生成
            event.event_type,
            event.room_id,
            event.source || 'unknown',
            event.user_id || null,
            event.user_name || null,
            event.content,
            event.ts,
            event.received_at || event.ts,
            event.raw ? JSON.stringify(event.raw) : null,
            (err: any) => {
              if (err && !errorOccurred) {
                errorOccurred = true;
                console.error('Error inserting event:', err);
              }
            }
          );
        });

        stmt.finalize((err) => {
          if (err) {
            console.error('Error finalizing statement:', err);
            db.run('ROLLBACK');
            reject(err);
          } else if (errorOccurred) {
            db.run('ROLLBACK');
            reject(new Error('One or more events failed to insert'));
          } else {
            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('Error committing transaction:', commitErr);
                reject(commitErr);
              } else {
                resolve();
              }
            });
          }
        });
      });
    });
  }

  public async forceFlush(): Promise<void> {
    while (this.queue.length > 0) {
      await this.flushQueue();
    }
  }

  public getQueueSize(): number {
    return this.queue.length;
  }

  public isQueueEmpty(): boolean {
    return this.queue.length === 0;
  }

  public setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(size, 1000));
  }

  public setFlushInterval(interval: number): void {
    this.flushInterval = Math.max(100, interval);
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.startFlushTimer();
  }

  public async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 强制刷新所有剩余事件
    await this.forceFlush();
  }
}
