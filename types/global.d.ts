// 扩展 globalThis 类型
declare global {
    var appName: string;
    var dataManager: import('../packages/main/src/utils/DataManager').DataManager;
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

export {};

// 注意：为避免覆盖第三方库的真实类型，这里不再声明 acfunlive-http-api 的模块。
// 通过 renderer 的 tsconfig.paths 指向 `../main/node_modules/acfunlive-http-api/dist/*`，
// 让 TypeScript 使用库内的 `*.d.ts` 进行严格类型检查。
