import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { 
  Comment, 
  Like, 
  EnterRoom, 
  FollowAuthor, 
  ThrowBanana, 
  Gift, 
  RichText, 
  JoinClub, 
  ShareLive,
  UserInfo,
  GiftDetail,
  RichTextSegment
} from 'acfunlive-http-api';
import { setupDanmuTest, getDanmuTestContext } from '../../shared/helpers/danmu-test-setup';
import { acfunApiTestHelper } from '../../shared/helpers/acfun-api-test-helper';

describe('基础弹幕消息结构验证', () => {
  setupDanmuTest();
  let testLiveRoom: { liveId: string; liverUID: number; title: string; liverName: string };

  beforeAll(() => {
    // 启用静默模式，减少测试输出
    acfunApiTestHelper.setSilentMode(true);
  });

  afterAll(async () => {
    // 恢复正常模式
    acfunApiTestHelper.setSilentMode(false);
    
    // 确保测试结束后连接被正确关闭
    const context = getDanmuTestContext();
    if (context.isConnected()) {
      console.log('🔄 测试结束，正在关闭连接...');
      await context.safeDisconnect();
    }
  });

  it('应该正确处理 Comment 类型事件', async () => {
    // 在测试用例内部获取直播间信息
    if (!testLiveRoom) {
      testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
      console.log('使用测试直播间:', testLiveRoom);
    }

    // 使用真实的用户ID和直播间信息
    const realUserInfo: UserInfo = {
      userID: parseInt(acfunApiTestHelper.getTestUserId()),
      nickname: '测试用户',
      avatar: 'https://example.com/avatar.jpg',
      medal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 5
      },
      managerType: 0
    };

    const realComment: Comment = {
      danmuInfo: {
        userInfo: realUserInfo
      },
      content: '这是一条测试弹幕'
    };

    // 使用反射访问私有方法进行测试
    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realComment);

    expect(normalizedEvent).toMatchObject({
      event_type: 'danmaku',
      user_id: acfunApiTestHelper.getTestUserId(),
      user_name: '测试用户',
      content: '这是一条测试弹幕'
    });

    expect(normalizedEvent.ts).toBeTypeOf('number');
    expect(normalizedEvent.received_at).toBeTypeOf('number');
    expect(normalizedEvent.raw).toBeDefined();
  });

  it('应该正确处理 Gift 类型事件', async () => {
    if (!testLiveRoom) {
      testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
    }

    const realUserInfo: UserInfo = {
      userID: parseInt(acfunApiTestHelper.getTestUserId()),
      nickname: '礼物用户',
      avatar: 'https://example.com/avatar2.jpg',
      medal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 3
      },
      managerType: 0
    };

    const realGiftDetail: GiftDetail = {
      giftId: 1,
      giftName: '香蕉',
      arLiveGift: false,
      payWalletType: 1,
      price: 10,
      webpPic: 'https://example.com/banana.webp',
      pngPic: 'https://example.com/banana.png',
      smallPngPic: 'https://example.com/banana_small.png',
      allowBatchSendSizeList: [1, 10, 66, 233],
      canCombo: true,
      canDraw: false,
      magicFaceId: 0,
      vupArId: 0,
      description: '香蕉礼物',
      redpackPrice: 0,
      cornerMarkerText: ''
    };

    const realGift: Gift = {
      danmuInfo: {
        userInfo: realUserInfo
      },
      giftDetail: realGiftDetail,
      count: 5,
      combo: 1,
      value: 50,
      comboId: 'combo123',
      slotDisplayDurationMs: 3000,
      expireDurationMs: 30000,
      drawGiftInfo: null
    };

    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realGift);

    expect(normalizedEvent).toMatchObject({
      event_type: 'gift',
      user_id: acfunApiTestHelper.getTestUserId(),
      user_name: '礼物用户',
      gift_name: '香蕉',
      gift_count: 5,
      gift_value: 50
    });

    expect(normalizedEvent.ts).toBeTypeOf('number');
    expect(normalizedEvent.received_at).toBeTypeOf('number');
    expect(normalizedEvent.raw).toBeDefined();
  });

  it('应该正确处理 ThrowBanana 类型事件', async () => {
    if (!testLiveRoom) {
      testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
    }

    const realUserInfo: UserInfo = {
      userID: parseInt(acfunApiTestHelper.getTestUserId()),
      nickname: '香蕉用户',
      avatar: 'https://example.com/avatar3.jpg',
      medal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 2
      },
      managerType: 0
    };

    const realThrowBanana: ThrowBanana = {
      danmuInfo: {
        userInfo: realUserInfo
      },
      count: 3
    };

    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realThrowBanana);

    expect(normalizedEvent).toMatchObject({
      event_type: 'banana',
      user_id: acfunApiTestHelper.getTestUserId(),
      user_name: '香蕉用户',
      banana_count: 3
    });

    expect(normalizedEvent.ts).toBeTypeOf('number');
    expect(normalizedEvent.received_at).toBeTypeOf('number');
    expect(normalizedEvent.raw).toBeDefined();
  });

  it('应该正确处理 Like 类型事件', async () => {
    if (!testLiveRoom) {
      testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
    }

    const realUserInfo: UserInfo = {
      userID: parseInt(acfunApiTestHelper.getTestUserId()),
      nickname: '点赞用户',
      avatar: 'https://example.com/avatar4.jpg',
      medal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 1
      },
      managerType: 0
    };

    const realLike: Like = {
      danmuInfo: {
        userInfo: realUserInfo
      },
      count: 1
    };

    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realLike);

    expect(normalizedEvent).toMatchObject({
      event_type: 'like',
      user_id: acfunApiTestHelper.getTestUserId(),
      user_name: '点赞用户',
      like_count: 1
    });

    expect(normalizedEvent.ts).toBeTypeOf('number');
    expect(normalizedEvent.received_at).toBeTypeOf('number');
    expect(normalizedEvent.raw).toBeDefined();
  });

  it('应该正确处理 EnterRoom 类型事件', async () => {
    if (!testLiveRoom) {
      testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
    }

    const realUserInfo: UserInfo = {
      userID: parseInt(acfunApiTestHelper.getTestUserId()),
      nickname: '新观众',
      avatar: 'https://example.com/avatar5.jpg',
      medal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 0
      },
      managerType: 0
    };

    const realEnterRoom: EnterRoom = {
      danmuInfo: {
        userInfo: realUserInfo
      }
    };

    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realEnterRoom);

    expect(normalizedEvent).toMatchObject({
      event_type: 'enter_room',
      user_id: acfunApiTestHelper.getTestUserId(),
      user_name: '新观众',
      content: '进入了直播间'
    });

    expect(normalizedEvent.ts).toBeTypeOf('number');
    expect(normalizedEvent.received_at).toBeTypeOf('number');
    expect(normalizedEvent.raw).toBeDefined();
  });

  it('应该正确处理 FollowAuthor 类型事件', async () => {
    if (!testLiveRoom) {
      testLiveRoom = await acfunApiTestHelper.getHotLiveRoom();
    }

    const realUserInfo: UserInfo = {
      userID: parseInt(acfunApiTestHelper.getTestUserId()),
      nickname: '新粉丝',
      avatar: 'https://example.com/avatar6.jpg',
      medal: {
        uperID: testLiveRoom.liverUID,
        userID: parseInt(acfunApiTestHelper.getTestUserId()),
        clubName: `${testLiveRoom.liverName}粉丝团`,
        level: 1
      },
      managerType: 0
    };

    const realFollowAuthor: FollowAuthor = {
      danmuInfo: {
        userInfo: realUserInfo
      }
    };

    const normalizedEvent = (getDanmuTestContext().adapter as any).normalizeDanmuEvent(realFollowAuthor);

    expect(normalizedEvent).toMatchObject({
      event_type: 'follow',
      user_id: acfunApiTestHelper.getTestUserId(),
      user_name: '新粉丝',
      content: '关注了主播'
    });

    expect(normalizedEvent.ts).toBeTypeOf('number');
    expect(normalizedEvent.received_at).toBeTypeOf('number');
    expect(normalizedEvent.raw).toBeDefined();
  });
});