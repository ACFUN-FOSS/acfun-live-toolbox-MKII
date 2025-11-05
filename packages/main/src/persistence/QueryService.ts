import { DatabaseManager } from './DatabaseManager';
import { NormalizedEvent, NormalizedEventType } from '../types';
import { TokenManager } from '../server/TokenManager';

export interface EventQuery {
  room_id?: string;
  room_kw?: string; // 主播用户名关键词（模糊匹配）
  from_ts?: number;
  to_ts?: number;
  type?: NormalizedEventType; // 兼容旧字段
  types?: NormalizedEventType[]; // 新字段：支持类型集合过滤
  user_id?: string;
  user_kw?: string; // 中文用户名关键词（模糊匹配）
  q?: string;
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
      room_kw,
      from_ts,
      to_ts,
      type,
      types,
      user_id,
      user_kw,
      q,
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

    // 解析 room_kw -> room_id 集合过滤
    if (room_kw && !room_id) {
      const resolvedRoomIds = await this.resolveRoomIdsByKeyword(room_kw);
      if (resolvedRoomIds.length === 0) {
        // 关键词无匹配，直接返回空结果
        return {
          items: [],
          total: 0,
          page,
          pageSize,
          hasNext: false
        };
      }
      conditions.push(`room_id IN (${resolvedRoomIds.map(() => '?').join(',')})`);
      params.push(...resolvedRoomIds);
    }

    if (from_ts) {
      conditions.push('timestamp >= ?');
      params.push(from_ts);
    }

    if (to_ts) {
      conditions.push('timestamp <= ?');
      params.push(to_ts);
    }

    // 类型过滤：支持单个或集合
    const typeList: NormalizedEventType[] | undefined = Array.isArray(types) && types.length > 0
      ? types
      : (type ? [type] : undefined);
    if (typeList && typeList.length > 0) {
      if (typeList.length === 1) {
        conditions.push('type = ?');
        params.push(typeList[0]);
      } else {
        conditions.push(`type IN (${typeList.map(() => '?').join(',')})`);
        params.push(...typeList);
      }
    }

    if (user_id) {
      conditions.push('user_id = ?');
      params.push(user_id);
    }

    if (user_kw && user_kw.trim().length > 0) {
      const likeUser = `%${user_kw.trim()}%`;
      conditions.push('(username LIKE ?)');
      params.push(likeUser);
    }

    if (q && q.trim().length > 0) {
      const like = `%${q.trim()}%`;
      conditions.push('(username LIKE ? OR payload LIKE ? OR raw_data LIKE ?)');
      params.push(like, like, like);
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
        source,
        user_id,
        username as user_name,
        payload as content,
        timestamp as ts,
        received_at,
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
      received_at: row.received_at || row.ts,
      room_id: row.room_id,
      source: row.source || 'unknown',
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
        source,
        user_id,
        username as user_name,
        payload as content,
        timestamp as ts,
        received_at,
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
      received_at: row.received_at || row.ts,
      room_id: row.room_id,
      source: row.source || 'unknown',
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

  // 根据主播用户名关键词解析 room_id 集合（使用 rooms_meta，必要时从 API 补充）
  private async resolveRoomIdsByKeyword(keyword: string): Promise<string[]> {
    const kw = keyword.trim();
    if (!kw) return [];

    // 先查 rooms_meta 表
    const like = `%${kw}%`;
    const existing = await this.executeQuery<{ room_id: string }>(
      'SELECT room_id FROM rooms_meta WHERE streamer_name LIKE ?',
      [like]
    );
    const matched = existing.map(r => String(r.room_id));
    if (matched.length > 0) {
      return matched;
    }

    // 无匹配则尝试补全 rooms_meta：遍历 events 中已知房间并拉取主播名
    const distinctRooms = await this.executeQuery<{ room_id: string }>(
      'SELECT DISTINCT room_id FROM events',
      []
    );
    const roomIds = distinctRooms.map(r => String(r.room_id));
    if (roomIds.length === 0) return [];

    const tokenMgr = TokenManager.getInstance();
    const api: any = tokenMgr.getApiInstance();

    for (const rid of roomIds) {
      try {
        let streamerName: string | undefined;
        let streamerUid: string | undefined;

        // 优先通过 live 用户信息获取 profile.userName
        try {
          const res = await api.live.getUserLiveInfo(Number(rid));
          if (res && res.success) {
            const profile = res.data?.profile || {};
            if (typeof profile.userName === 'string' && profile.userName.trim().length > 0) {
              streamerName = String(profile.userName);
            }
            if (profile.userID != null) {
              streamerUid = String(profile.userID);
            }
          }
        } catch {}

        // 兜底通过 danmu.getLiveRoomInfo 获取 owner.userName
        if (!streamerName) {
          try {
            const roomRes = await api.danmu.getLiveRoomInfo(rid);
            const owner = roomRes?.data?.owner || roomRes?.owner || {};
            const n = owner.userName || owner.nickname || owner.name;
            if (typeof n === 'string' && n.trim().length > 0) {
              streamerName = String(n);
            }
            const uidRaw = owner.userID || owner.uid || owner.id;
            if (uidRaw != null) streamerUid = String(uidRaw);
          } catch {}
        }

        if (streamerName) {
          // upsert 到 rooms_meta
          await this.executeRun(
            `INSERT INTO rooms_meta (room_id, streamer_name, streamer_user_id, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(room_id) DO UPDATE SET streamer_name=excluded.streamer_name, streamer_user_id=excluded.streamer_user_id, updated_at=CURRENT_TIMESTAMP`,
            [rid, streamerName, streamerUid || null]
          );
        }
      } catch {}
    }

    // 重新按关键词查一次
    const refreshed = await this.executeQuery<{ room_id: string }>(
      'SELECT room_id FROM rooms_meta WHERE streamer_name LIKE ?',
      [like]
    );
    return refreshed.map(r => String(r.room_id));
  }

  private async executeRun(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseManager.getDb();
      db.run(sql, params, (err: any) => {
        if (err) {
          console.error('Exec error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}