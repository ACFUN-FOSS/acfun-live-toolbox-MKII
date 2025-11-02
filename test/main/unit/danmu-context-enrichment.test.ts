import { describe, it, expect, beforeEach } from 'vitest';
import { AcfunAdapter } from '../../adapter/AcfunAdapter';

describe('弹幕事件上下文丰富化', () => {
  let adapter: AcfunAdapter;

  beforeEach(() => {
    adapter = new AcfunAdapter();
  });

  it('应该正确提取用户级别信息', () => {
    const mockEvent = {
      sendTime: Date.now(),
      danmuInfo: {
        userInfo: {
          userID: 12345,
          nickname: '测试用户',
          avatar: 'https://example.com/avatar.jpg',
          medal: {
            uperID: 67890,
            userID: 12345,
            clubName: '测试粉丝�?,
            level: 15
          },
          managerType: 1
        }
      },
      content: '测试弹幕内容'
    };

    // 使用反射访问私有方法进行测试
    const normalizedEvent = (adapter as any).normalizeDanmuEvent(mockEvent, 'Comment');

    expect(normalizedEvent).toBeDefined();
    expect(normalizedEvent.raw._context).toBeDefined();
    expect(normalizedEvent.raw._context.userLevel).toBe(15);
    expect(normalizedEvent.raw._context.userMedal).toEqual({
      uperID: 67890,
      userID: 12345,
      clubName: '测试粉丝�?,
      level: 15
    });
    expect(normalizedEvent.raw._context.userManagerType).toBe(1);
    expect(normalizedEvent.raw._context.userAvatar).toBe('https://example.com/avatar.jpg');
  });

  it('应该处理没有勋章信息的用�?, () => {
    const mockEvent = {
      sendTime: Date.now(),
      danmuInfo: {
        userInfo: {
          userID: 12345,
          nickname: '测试用户',
          avatar: [{
            url: 'https://example.com/avatar.jpg'
          }],
          medal: null,
          managerType: 0
        }
      },
      content: '测试弹幕内容'
    };

    const normalizedEvent = (adapter as any).normalizeDanmuEvent(mockEvent, 'Comment');

    expect(normalizedEvent.raw._context.userLevel).toBe(0);
    expect(normalizedEvent.raw._context.userMedal).toBeNull();
    expect(normalizedEvent.raw._context.userManagerType).toBe(0);
  });

  it('应该包含会话和连接信�?, () => {
    const mockEvent = {
      sendTime: Date.now(),
      danmuInfo: {
        userInfo: {
          userID: 12345,
          nickname: '测试用户',
          avatar: [{
            url: 'https://example.com/avatar.jpg'
          }],
          medal: null,
          managerType: 0
        }
      },
      content: '测试弹幕内容'
    };

    // 设置适配器的会话信息
    (adapter as any).sessionId = 'test-session-123';
    (adapter as any).connectionStartTime = Date.now() - 5000;
    (adapter as any).reconnectAttempts = 2;

    const normalizedEvent = (adapter as any).normalizeDanmuEvent(mockEvent, 'Comment');

    expect(normalizedEvent.raw._context.sessionId).toBe('test-session-123');
    expect(normalizedEvent.raw._context.connectionDuration).toBeGreaterThanOrEqual(0);
    expect(normalizedEvent.raw._context.reconnectAttempts).toBe(2);
    expect(normalizedEvent.raw._context.adapterVersion).toBeDefined();
  });
});
