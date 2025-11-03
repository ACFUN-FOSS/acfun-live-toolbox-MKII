import { describe, it, expect, beforeAll } from 'vitest';
import type { UserInfo } from 'acfunlive-http-api';
import { setupDanmuTest, getDanmuTestContext, TEST_ROOM_ID } from '../../shared/helpers/danmu-test-setup';
import { acfunApiTestHelper, type TestLiveRoomData } from '../../shared/helpers/acfun-api-test-helper';

describe('未知事件类型处理', () => {
  const testContext = setupDanmuTest();
  let testLiveRoom: TestLiveRoomData;

  beforeAll(async () => {
    testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
  });

  it('应该正确处理未知类型的事件', async () => {
    const realUnknownEvent = {
      sendTime: Date.now(),
      danmuInfo: {
        userInfo: {
          userID: parseInt(acfunApiTestHelper.getTestUserId()),
          nickname: '未知事件用户',
          avatar: 'https://example.com/unknown_avatar.jpg',
          medal: {
            uperID: testLiveRoom.liverUID,
            userID: parseInt(acfunApiTestHelper.getTestUserId()),
            clubName: `${testLiveRoom.liverName}粉丝团`,
            level: 5
          },
          managerType: 0
        } as UserInfo
      },
      unknownField: '这是一个未知的字段',
      customData: { test: 'data' }
    } as any;

    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realUnknownEvent);

    expect(normalizedEvent).toMatchObject({
      event_type: 'system',
      room_id: TEST_ROOM_ID,
      source: 'acfun',
      user_id: acfunApiTestHelper.getTestUserId(),
      user_name: '未知事件用户',
      content: JSON.stringify(realUnknownEvent)
    });

    expect(normalizedEvent.raw).toHaveProperty('_context');
    expect(normalizedEvent.raw._context).toMatchObject({
      userAvatar: 'https://example.com/unknown_avatar.jpg',
      userMedal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 5
      },
      userManagerType: 0,
      userLevel: 5
    });
  });
});