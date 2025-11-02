import type { NormalizedEvent, NormalizedEventType } from '../types';

const ALLOWED_TYPES: NormalizedEventType[] = ['danmaku','gift','follow','like','enter','system'];

// 事件验证规则
interface ValidationRule {
  name: string;
  validate: (event: NormalizedEvent) => boolean;
  errorMessage: string;
}

// 事件过滤器接口
export interface EventFilter {
  name: string;
  filter: (event: NormalizedEvent) => boolean;
  description: string;
}

// 预定义的验证规则
const VALIDATION_RULES: ValidationRule[] = [
  {
    name: 'timestamp_valid',
    validate: (event) => {
      const now = Date.now();
      const ts = Number(event.ts);
      // 时间戳应该在合理范围内（过去24小时到未来1小时）
      return ts > (now - 24 * 60 * 60 * 1000) && ts < (now + 60 * 60 * 1000);
    },
    errorMessage: 'Event timestamp is outside valid range'
  },
  {
    name: 'room_id_valid',
    validate: (event) => {
      return typeof event.room_id === 'string' && event.room_id.length > 0 && event.room_id.length <= 128;
    },
    errorMessage: 'Room ID is invalid or too long'
  },
  {
    name: 'source_valid',
    validate: (event) => {
      const validSources = ['acfun', 'bilibili', 'douyu', 'huya', 'unknown'];
      return validSources.includes(event.source);
    },
    errorMessage: 'Event source is not recognized'
  },
  {
    name: 'user_info_consistent',
    validate: (event) => {
      // 如果有用户ID，应该也有用户名（除非是系统事件）
      if (event.event_type === 'system') return true;
      if (event.user_id && !event.user_name) return false;
      return true;
    },
    errorMessage: 'User information is inconsistent'
  },
  {
    name: 'content_appropriate',
    validate: (event) => {
      if (!event.content) return true;
      // 检查内容长度和基本格式
      if (event.content.length > 1000) return false;
      // 检查是否包含过多的重复字符
      const repeatedPattern = /(.)\1{20,}/;
      return !repeatedPattern.test(event.content);
    },
    errorMessage: 'Event content is inappropriate or too long'
  }
];

// 预定义的过滤器
const DEFAULT_FILTERS: EventFilter[] = [
  {
    name: 'spam_filter',
    description: 'Filter out potential spam messages',
    filter: (event) => {
      if (event.event_type !== 'danmaku') return true;
      if (!event.content) return true;
      
      // 检查是否是重复内容
      const repeatedChars = /(.)\1{10,}/.test(event.content);
      const tooManyEmojis = (event.content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length > 10;
      
      return !repeatedChars && !tooManyEmojis;
    }
  },
  {
    name: 'rate_limit_filter',
    description: 'Filter events that exceed rate limits per user',
    filter: (() => {
      const userEventCounts = new Map<string, { count: number; lastReset: number }>();
      const RATE_LIMIT = 30; // 每分钟最多30条消息
      const WINDOW_MS = 60 * 1000; // 1分钟窗口
      
      return (event: NormalizedEvent) => {
        if (!event.user_id) return true;
        
        const now = Date.now();
        const userKey = `${event.room_id}:${event.user_id}`;
        const userStats = userEventCounts.get(userKey);
        
        if (!userStats || (now - userStats.lastReset) > WINDOW_MS) {
          userEventCounts.set(userKey, { count: 1, lastReset: now });
          return true;
        }
        
        if (userStats.count >= RATE_LIMIT) {
          return false; // 超过速率限制
        }
        
        userStats.count++;
        return true;
      };
    })()
  },
  {
    name: 'duplicate_filter',
    description: 'Filter out duplicate events',
    filter: (() => {
      const recentEvents = new Map<string, number>();
      const DUPLICATE_WINDOW_MS = 5 * 1000; // 5秒内的重复事件
      
      return (event: NormalizedEvent) => {
        const eventKey = `${event.room_id}:${event.user_id}:${event.event_type}:${event.content}`;
        const now = Date.now();
        const lastSeen = recentEvents.get(eventKey);
        
        if (lastSeen && (now - lastSeen) < DUPLICATE_WINDOW_MS) {
          return false; // 重复事件
        }
        
        recentEvents.set(eventKey, now);
        
        // 清理过期的记录
        if (recentEvents.size > 10000) {
          const cutoff = now - DUPLICATE_WINDOW_MS;
          for (const [key, timestamp] of recentEvents.entries()) {
            if (timestamp < cutoff) {
              recentEvents.delete(key);
            }
          }
        }
        
        return true;
      };
    })()
  }
];

function clampType(t: any): NormalizedEventType {
  const s = String(t || '').toLowerCase();
  const mapped =
    s === 'comment' ? 'danmaku' :
    s === 'danmaku' ? 'danmaku' :
    s === 'gift' ? 'gift' :
    s === 'follow' ? 'follow' :
    s === 'like' ? 'like' :
    s === 'enter' ? 'enter' : 'system';
  return (ALLOWED_TYPES as string[]).includes(mapped) ? (mapped as NormalizedEventType) : 'system';
}

function sanitizeText(input: any, maxLen = 500): string | null {
  if (input == null) return null;
  let s = String(input);
  // 去除控制字符与多余空白
  s = s.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!s) return null;
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/**
 * 验证事件是否符合规范
 */
export function validateEvent(event: NormalizedEvent, rules: ValidationRule[] = VALIDATION_RULES): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const rule of rules) {
    try {
      if (!rule.validate(event)) {
        errors.push(`${rule.name}: ${rule.errorMessage}`);
      }
    } catch (error) {
      errors.push(`${rule.name}: Validation rule failed with error: ${error}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * 应用事件过滤器
 */
export function applyFilters(event: NormalizedEvent, filters: EventFilter[] = DEFAULT_FILTERS): { passed: boolean; failedFilters: string[] } {
  const failedFilters: string[] = [];
  
  for (const filter of filters) {
    try {
      if (!filter.filter(event)) {
        failedFilters.push(filter.name);
      }
    } catch (error) {
      console.warn(`Filter ${filter.name} failed with error:`, error);
      failedFilters.push(filter.name);
    }
  }
  
  return {
    passed: failedFilters.length === 0,
    failedFilters
  };
}

/**
 * 获取事件质量评分 (0-100)
 */
export function getEventQualityScore(event: NormalizedEvent): number {
  let score = 100;
  
  // 检查必需字段的完整性
  if (!event.room_id) score -= 20;
  if (!event.user_id && event.event_type !== 'system') score -= 15;
  if (!event.user_name && event.event_type !== 'system') score -= 10;
  if (!event.content && event.event_type === 'danmaku') score -= 25;
  
  // 检查时间戳的合理性
  const now = Date.now();
  const timeDiff = Math.abs(now - event.ts);
  if (timeDiff > 60 * 1000) score -= 5; // 超过1分钟的延迟
  if (timeDiff > 5 * 60 * 1000) score -= 10; // 超过5分钟的延迟
  
  // 检查内容质量
  if (event.content) {
    const contentLength = event.content.length;
    if (contentLength < 2) score -= 5; // 内容过短
    if (contentLength > 200) score -= 5; // 内容过长
    
    // 检查重复字符
    const repeatedPattern = /(.)\1{5,}/;
    if (repeatedPattern.test(event.content)) score -= 10;
  }
  
  // 检查原始数据的存在
  if (!event.raw) score -= 5;
  
  return Math.max(0, Math.min(100, score));
}

export function ensureNormalized(event: NormalizedEvent): NormalizedEvent {
  const tsRaw = Number(event.ts ?? Date.now());
  const safeTs = Number.isFinite(tsRaw) ? tsRaw : Date.now();
  
  const receivedAtRaw = Number(event.received_at ?? Date.now());
  const safeReceivedAt = Number.isFinite(receivedAtRaw) ? receivedAtRaw : Date.now();

  const normalized: NormalizedEvent = {
    ts: safeTs,
    received_at: safeReceivedAt,
    room_id: sanitizeText(event.room_id, 128) || String(event.room_id || ''),
    source: sanitizeText(event.source, 64) || 'unknown',
    event_type: clampType(event.event_type),
    user_id: sanitizeText(event.user_id, 128),
    user_name: sanitizeText(event.user_name, 128),
    content: sanitizeText(event.content, 500),
    raw: event.raw ?? null
  };

  // 验证标准化后的事件
  const validation = validateEvent(normalized);
  if (!validation.isValid) {
    console.warn('[EventNormalizer] Event validation failed:', validation.errors, normalized);
  }

  return normalized;
}

// 导出默认过滤器和验证规则，供其他模块使用
export { DEFAULT_FILTERS, VALIDATION_RULES };