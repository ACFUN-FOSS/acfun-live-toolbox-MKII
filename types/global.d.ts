// 扩展 globalThis 类型
declare global {
    var appName: string;
  var appVersion: string;
  var windowManager: WindowManager;
  var configManager: ConfigManager;
  var httpManager: HttpManager;
  var appManager: AppManager;
  var app: Electron.App;
}

// 扩展 Window 接口
interface Window {
  overlayApi?: {
    id: string;
    room: string;
    token: string;
    action: (actionId: string, data?: any) => void;
    close: () => void;
    update: (updates: any) => void;
  };
}

// 统一 Overlay 事件信封与子页动作消息类型
declare global {
  /** 从主进程包装页向子页发送的事件信封 */
  type OverlayEventEnvelope = {
    type: 'overlay-event';
    overlayId: string;
    eventType: 'overlay-message';
    event: string;
    payload?: any;
  };

  /** SSE 初始化事件数据结构（只读 store 初始快照） */
  type OverlaySseInit = { overlay: any };
  /** SSE 更新事件数据结构（只读 store 更新） */
  type OverlaySseUpdate = { overlay: any };
  /** SSE 消息事件数据结构（主进程主动消息） */
  type OverlaySseMessage = { overlayId: string; event: string; payload?: any };
  /** SSE 关闭事件数据结构 */
  type OverlaySseClosed = { overlayId: string };

  /** 子页向主进程包装页发送的动作：执行自定义行为 */
  type OverlayActionMessage = { type: 'overlay-action'; overlayId: string; action: string; data?: any };
  /** 子页向主进程包装页发送的动作：关闭 Overlay */
  type OverlayCloseMessage = { type: 'overlay-close'; overlayId: string };
  /** 子页向主进程包装页发送的动作：更新 Overlay 配置 */
  type OverlayUpdateMessage = { type: 'overlay-update'; overlayId: string; updates: any };
}

export {};

// 注意：为避免覆盖第三方库的真实类型，这里不再声明 acfunlive-http-api 的模块。
// 通过 renderer 的 tsconfig.paths 指向 `../main/node_modules/acfunlive-http-api/dist/*`，
// 让 TypeScript 使用库内的 `*.d.ts` 进行严格类型检查。
