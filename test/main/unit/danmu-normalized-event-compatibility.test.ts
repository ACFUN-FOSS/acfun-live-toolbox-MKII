import { describe, it, expect, beforeAll } from 'vitest';
import type { UserInfo } from 'acfunlive-http-api';
import { setupDanmuTest, getDanmuTestContext } from '../../shared/helpers/danmu-test-setup';
import { acfunApiTestHelper, type TestLiveRoomData } from '../../shared/helpers/acfun-api-test-helper';

describe('NormalizedEvent 接口兼容性', () => {
  const testContext = setupDanmuTest();
  let testLiveRoom: TestLiveRoomData;

  beforeAll(async () => {
    testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
  });

  it('所有标准化事件都应该符合 NormalizedEvent 接口', async () => {
    const testEvents = [
      { content: '测试弹幕' },
      { 
        giftDetail: { 
          giftName: '测试礼物', 
          giftID: 1, 
          arLiveName: '', 
          payWalletType: 1, 
          price: 100, 
          webpPic: '', 
          pngPic: '', 
          smallPngPic: '', 
          allowBatchSendSizeList: [], 
          canCombo: false, 
          canDraw: false, 
          magicFaceID: 0, 
          vupArID: 0, 
          description: '', 
          redpackPrice: 0, 
          cornerMarkerText: '' 
        }, 
        count: 1, 
        combo: 1, 
        value: 100, 
        comboID: '', 
        slotDisplayDuration: 0, 
        expireDuration: 0 
      },
      { likeCount: 5 },
      { enterRoomAttach: 'test' },
      { followAuthor: true },
      { bananaCount: 3 },
      { segments: [{ type: 'plain', text: '测试', color: '#000' }] },
      { 
        joinTime: Date.now(), 
        fansInfo: { 
          userID: parseInt(acfunApiTestHelper.getTestUserId()), 
          nickname: 'fan', 
          avatar: '', 
          medal: { uperID: testLiveRoom.liverUID, userID: parseInt(acfunApiTestHelper.getTestUserId()), clubName: `${testLiveRoom.liverName}粉丝团`, level: 1 }, 
          managerType: 0 
        }, 
        uperInfo: { 
          userID: testLiveRoom.liverUID, 
          nickname: testLiveRoom.liverName, 
          avatar: '', 
          medal: { uperID: testLiveRoom.liverUID, userID: testLiveRoom.liverUID, clubName: `${testLiveRoom.liverName}粉丝团`, level: 1 }, 
          managerType: 0 
        } 
      },
      { sharePlatform: 1, sharePlatformIcon: '' }
    ];

    testEvents.forEach((eventData, index) => {
      const realEvent = {
        sendTime: Date.now(),
        danmuInfo: {
          userInfo: {
            userID: parseInt(acfunApiTestHelper.getTestUserId()) + index,
            nickname: `测试用户${index}`,
            avatar: `https://example.com/avatar${index}.jpg`,
            medal: {
              uperID: testLiveRoom.liverUID,
              userID: parseInt(acfunApiTestHelper.getTestUserId()) + index,
              clubName: `${testLiveRoom.liverName}粉丝团`,
              level: index + 1
            },
            managerType: 0
          } as UserInfo
        },
        ...eventData
      };

      const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realEvent);

      // 验证所有必需字段
      expect(normalizedEvent).toHaveProperty('ts');
      expect(normalizedEvent).toHaveProperty('received_at');
      expect(normalizedEvent).toHaveProperty('room_id');
      expect(normalizedEvent).toHaveProperty('source');
      expect(normalizedEvent).toHaveProperty('event_type');
      expect(normalizedEvent).toHaveProperty('raw');

      // 验证字段类型
      expect(typeof normalizedEvent.ts).toBe('number');
      expect(typeof normalizedEvent.received_at).toBe('number');
      expect(typeof normalizedEvent.room_id).toBe('string');
      expect(typeof normalizedEvent.source).toBe('string');
      expect(typeof normalizedEvent.event_type).toBe('string');

      // 验证事件类型在允许的范围内      const allowedTypes = ['danmaku', 'gift', 'follow', 'like', 'enter', 'system'];
      expect(allowedTypes).toContain(normalizedEvent.event_type);

      // 验证原始数据包含上下文信息      expect(normalizedEvent.raw._context).toBeDefined();
      expect(normalizedEvent.raw._context.adapterVersion).toBe('2.0.0');
    });
  });
});