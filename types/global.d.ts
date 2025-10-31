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

// Ambient module declarations for dynamic imports in AuthManager
declare module 'acfunlive-http-api/dist/services/AuthService' {
  export class AuthService {
    constructor(httpClient: any);
    qrLogin(...args: any[]): Promise<any>;
    checkQrLoginStatus(...args: any[]): Promise<any>;
  }
}

declare module 'acfunlive-http-api/dist/core/HttpClient' {
  export class HttpClient {
    constructor(options: any);
  }
}

declare module 'acfunlive-http-api/src/services/AuthService' {
  export class AuthService {
    constructor(httpClient: any);
    qrLogin(...args: any[]): Promise<any>;
    checkQrLoginStatus(...args: any[]): Promise<any>;
  }
}

declare module 'acfunlive-http-api/src/core/HttpClient' {
  export class HttpClient {
    constructor(options: any);
  }
}
