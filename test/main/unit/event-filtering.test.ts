import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventFilterManager } from '../events/EventFilterManager';
import { ConfigManager } from '../config/ConfigManager';
import { DEFAULT_FILTERS, validateEvent, applyFilters, getEventQualityScore } from '../events/normalize';
import type { NormalizedEvent } from '../types';

describe('事件过滤和处理机�?, () => {
  let configManager: ConfigManager;
  let filterManager: EventFilterManager;

  beforeEach(() => {
    configManager = new ConfigManager();
    filterManager = new EventFilterManager(configManager);
  });

  afterEach(() => {
    filterManager.resetStats();
  });

  describe('默认过滤�?, () => {
    it('应该正确过滤垃圾信息', () => {
      const spamEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'aaaaaaaaaaaaaaaaaaa', // 重复字符
        raw: null
      };

      const result = applyFilters(spamEvent, DEFAULT_FILTERS);
      expect(result.passed).toBe(false);
      expect(result.failedFilters).toContain('spam_filter');
    });

    it('应该正确过滤重复事件', () => {
      const duplicateFilter = DEFAULT_FILTERS.find(f => f.name === 'duplicate_filter')!;
      
      const event: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'Hello World',
        raw: null
      };

      // 第一次应该通过
      expect(duplicateFilter.filter(event)).toBe(true);
      
      // 立即重复应该被过�?      expect(duplicateFilter.filter(event)).toBe(false);
    });

    it('应该正确应用速率限制', () => {
      const rateLimitFilter = DEFAULT_FILTERS.find(f => f.name === 'rate_limit_filter')!;
      
      const baseEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'Test message',
        raw: null
      };

      // 发�?1条消息，�?1条应该被过滤
      let filtered = false;
      for (let i = 0; i < 31; i++) {
        const event = { ...baseEvent, content: `Message ${i}` };
        const passed = rateLimitFilter.filter(event);
        if (!passed) {
          filtered = true;
          break;
        }
      }
      
      expect(filtered).toBe(true);
    });
  });

  describe('事件验证', () => {
    it('应该验证必需字段', () => {
      const invalidEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: '', // 无效的房间ID
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'Hello',
        raw: null
      };

      const validation = validateEvent(invalidEvent);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('应该验证时间戳的合理�?, () => {
      const futureEvent: NormalizedEvent = {
        ts: Date.now() + 2 * 60 * 60 * 1000, // 2小时�?        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'Hello',
        raw: null
      };

      const validation = validateEvent(futureEvent);
      expect(validation.isValid).toBe(false);
    });

    it('应该验证用户信息的一致�?, () => {
      const inconsistentEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: null, // 有用户ID但没有用户名
        content: 'Hello',
        raw: null
      };

      const validation = validateEvent(inconsistentEvent);
      expect(validation.isValid).toBe(false);
    });
  });

  describe('事件质量评分', () => {
    it('应该为完整事件给出高�?, () => {
      const goodEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'This is a good quality message',
        raw: { original: 'data' }
      };

      const score = getEventQualityScore(goodEvent);
      expect(score).toBeGreaterThan(90);
    });

    it('应该为缺失字段的事件降分', () => {
      const incompleteEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: '', // 缺失房间ID
        source: 'acfun',
        event_type: 'danmaku',
        user_id: null, // 缺失用户ID
        user_name: null, // 缺失用户�?        content: 'x', // 内容过短
        raw: null // 缺失原始数据
      };

      const score = getEventQualityScore(incompleteEvent);
      expect(score).toBeLessThan(50);
    });

    it('应该为过时事件降�?, () => {
      const oldEvent: NormalizedEvent = {
        ts: Date.now() - 10 * 60 * 1000, // 10分钟�?        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'Old message',
        raw: null
      };

      const score = getEventQualityScore(oldEvent);
      expect(score).toBeLessThan(100);
    });
  });

  describe('EventFilterManager', () => {
    it('应该正确处理事件并应用过滤器', () => {
      const event: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'Normal message',
        raw: null
      };

      const result = filterManager.processEvent(event);
      expect(result.passed).toBe(true);
      expect(result.qualityScore).toBeGreaterThan(0);
    });

    it('应该正确统计过滤结果', () => {
      const goodEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'Good message',
        raw: null
      };

      const spamEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user456',
        user_name: 'SpamUser',
        content: 'aaaaaaaaaaaaaaaaaaa', // 垃圾信息
        raw: null
      };

      filterManager.processEvent(goodEvent);
      filterManager.processEvent(spamEvent);

      const stats = filterManager.getStats();
      expect(stats.totalProcessed).toBe(2);
      expect(stats.totalFiltered).toBe(1);
    });

    it('应该支持自定义过滤规�?, () => {
      filterManager.addCustomRule({
        name: 'test-custom-filter',
        description: 'Test custom filter',
        enabled: true,
        settings: {
          blockedWords: ['blocked']
        }
      });

      const blockedEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'This contains blocked word',
        raw: null
      };

      const result = filterManager.processEvent(blockedEvent);
      expect(result.passed).toBe(false);
    });

    it('应该支持最低质量分数设�?, () => {
      filterManager.updateSettings({
        minQualityScore: 80
      });

      const lowQualityEvent: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: '',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: null,
        user_name: null,
        content: 'x',
        raw: null
      };

      const result = filterManager.processEvent(lowQualityEvent);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Quality score too low');
    });

    it('应该能够测试事件而不影响统计', () => {
      const event: NormalizedEvent = {
        ts: Date.now(),
        received_at: Date.now(),
        room_id: 'test-room',
        source: 'acfun',
        event_type: 'danmaku',
        user_id: 'user123',
        user_name: 'TestUser',
        content: 'Test message',
        raw: null
      };

      const testResult = filterManager.testEvent(event);
      expect(testResult.passed).toBe(true);
      expect(testResult.qualityScore).toBeGreaterThan(0);

      // 统计应该不受影响
      const stats = filterManager.getStats();
      expect(stats.totalProcessed).toBe(0);
    });
  });

  describe('性能测试', () => {
    it('应该能够快速处理大量事�?, () => {
      const startTime = Date.now();
      const eventCount = 1000;

      for (let i = 0; i < eventCount; i++) {
        const event: NormalizedEvent = {
          ts: Date.now(),
          received_at: Date.now(),
          room_id: 'test-room',
          source: 'acfun',
          event_type: 'danmaku',
          user_id: `user${i}`,
          user_name: `User${i}`,
          content: `Message ${i}`,
          raw: null
        };

        filterManager.processEvent(event);
      }

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(1000); // 应该�?秒内完成
      
      const stats = filterManager.getStats();
      expect(stats.totalProcessed).toBe(eventCount);
    });
  });
});
