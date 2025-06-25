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

export {};
