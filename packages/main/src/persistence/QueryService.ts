import { DatabaseManager } from './DatabaseManager';
import { NormalizedEvent, NormalizedEventType } from '../types';

export interface EventQuery {
  room_id?: string;
  from_ts?: number;
  to_ts?: number;
  type?: NormalizedEventType;
  page?: number;
  pageSize?: number;
}

export interface EventQueryResult {
  items: NormalizedEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}

export class QueryService {
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  public async queryEvents(query: EventQuery): Promise<EventQueryResult> {
    const {
      room_id,
      from_ts,
      to_ts,
      type,
      page = 1,
      pageSize = 200
    } = query;

    // 构建 WHERE 条件
    const conditions: string[] = [];
    const params: any[] = [];

    if (room_id) {
      conditions.push('room_id = ?');
      params.push(room_id);
    }

    if (from_ts) {
      conditions.push('timestamp >= ?');
      params.push(from_ts);
    }

    if (to_ts) {
      conditions.push('timestamp <= ?');
      params.push(to_ts);
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 计算总数
    const countSql = `SELECT COUNT(*) as total FROM events ${whereClause}`;
    const totalResult = await this.executeQuery<{ total: number }>(countSql, params);
    const total = totalResult[0]?.total || 0;

    // 计算分页
    const offset = (page - 1) * pageSize;
    const hasNext = offset + pageSize < total;

    // 查询数据
    const dataSql = `
      SELECT 
        id,
        event_id,
        type as event_type,
        room_id,
        user_id,
        username as user_name,
        payload as content,
        timestamp as ts,
        raw_data as raw,
        created_at
      FROM events 
      ${whereClause}
      ORDER BY timestamp DESC, id DESC
      LIMIT ? OFFSET ?
    `;

    const dataParams = [...params, pageSize, offset];
    const rows = await this.executeQuery<any>(dataSql, dataParams);

    // 转换为 NormalizedEvent 格式
    const items: NormalizedEvent[] = rows.map(row => ({
      ts: row.ts,
      room_id: row.room_id,
      event_type: row.event_type as NormalizedEventType,
      user_id: row.user_id || null,
      user_name: row.user_name || null,
      content: row.content || null,
      raw: row.raw ? JSON.parse(row.raw) : null
    }));

    return {
      items,
      total,
      page,
      pageSize,
      hasNext
    };
  }

  private async executeQuery<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseManager.getDb();
      
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('Query error:', err);
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  public async getEventById(id: number): Promise<NormalizedEvent | null> {
    const sql = `
      SELECT 
        id,
        event_id,
        type as event_type,
        room_id,
        user_id,
        username as user_name,
        payload as content,
        timestamp as ts,
        raw_data as raw,
        created_at
      FROM events 
      WHERE id = ?
    `;

    const rows = await this.executeQuery<any>(sql, [id]);
    
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      ts: row.ts,
      room_id: row.room_id,
      event_type: row.event_type as NormalizedEventType,
      user_id: row.user_id || null,
      user_name: row.user_name || null,
      content: row.content || null,
      raw: row.raw ? JSON.parse(row.raw) : null
    };
  }

  public async getEventStats(room_id?: string): Promise<{
    total: number;
    byType: Record<string, number>;
    dateRange: { earliest: number | null; latest: number | null };
  }> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (room_id) {
      conditions.push('room_id = ?');
      params.push(room_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 总数和类型统计
    const statsSql = `
      SELECT 
        COUNT(*) as total,
        type,
        COUNT(type) as type_count,
        MIN(timestamp) as earliest,
        MAX(timestamp) as latest
      FROM events 
      ${whereClause}
      GROUP BY type
    `;

    const statsRows = await this.executeQuery<{
      total: number;
      type: string;
      type_count: number;
      earliest: number;
      latest: number;
    }>(statsSql, params);

    const byType: Record<string, number> = {};
    let total = 0;
    let earliest: number | null = null;
    let latest: number | null = null;

    for (const row of statsRows) {
      byType[row.type] = row.type_count;
      total += row.type_count;
      
      if (earliest === null || row.earliest < earliest) {
        earliest = row.earliest;
      }
      
      if (latest === null || row.latest > latest) {
        latest = row.latest;
      }
    }

    return {
      total,
      byType,
      dateRange: { earliest, latest }
    };
  }
}