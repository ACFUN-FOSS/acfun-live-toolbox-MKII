import { describe, it, expect, beforeAll } from 'vitest';
import type { UserInfo } from 'acfunlive-http-api';
import { setupDanmuTest, getDanmuTestContext, TEST_ROOM_ID } from '../../shared/helpers/danmu-test-setup';
import { acfunApiTestHelper, type TestLiveRoomData } from '../../shared/helpers/acfun-api-test-helper';

describe('事件上下文信息验�?, () => {
  const testContext = setupDanmuTest();
  let testLiveRoom: TestLiveRoomData;

  beforeAll(async () => {
    testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
  });

  it('应该包含完整的上下文信息', async () => {
    const realUserInfo: UserInfo = {
      userID: parseInt(acfunApiTestHelper.getTestUserId()),
      nickname: '测试用户',
      avatar: 'https://example.com/avatar.jpg',
      medal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 3
      },
      managerType: 1 // 管理�?    };

    const realComment = {
      sendTime: Date.now(),
      danmuInfo: {
        userInfo: realUserInfo
      },
      content: '测试上下文信�?
    };

    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realComment);

    expect(normalizedEvent.raw).toHaveProperty('_context');
    expect(normalizedEvent.raw._context).toMatchObject({
      sessionId: null, // 未连接时�?null
      connectionDuration: expect.any(Number),
      reconnectAttempts: expect.any(Number),
      userAvatar: 'https://example.com/avatar.jpg',
      userMedal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 3
      },
      userManagerType: 1,
      userLevel: 3,
      adapterVersion: '2.0.0'
    });
  });

  it('应该正确处理缺少用户信息的情�?, async () => {
    const realUserInfoWithoutMedal: UserInfo = {
      userID: parseInt(acfunApiTestHelper.getTestUserId()),
      nickname: '无勋章用�?,
      avatar: 'https://example.com/no_medal_avatar.jpg',
      managerType: 0
    };

    const realComment = {
      sendTime: Date.now(),
      danmuInfo: {
        userInfo: realUserInfoWithoutMedal
      },
      content: '测试无勋章用�?
    };

    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realComment);

    expect(normalizedEvent.raw._context).toMatchObject({
      userAvatar: 'https://example.com/no_medal_avatar.jpg',
      userMedal: null,
      userManagerType: 0,
      userLevel: 0
    });
  });
});