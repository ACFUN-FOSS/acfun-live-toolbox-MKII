import type { AppModule } from "../AppModule.js";
import { ModuleContext } from "../ModuleContext.js";
import { BrowserWindow } from "electron";
import type { AppInitConfig } from "../AppInitConfig.js";

export interface WindowConfig {
  width: number;
  height: number;
  resizable: boolean;
  title: string;
  frame: boolean;
  allowMultipleWindows: boolean;
  targetUrl: string; // 添加 targetUrl 属性
  alwaysOnTop?: boolean; // 新增置顶属性
  focusable?: boolean; // 新增是否可聚焦属性
}

export class WindowManager implements AppModule {
  readonly #preload: { path: string };
  readonly #renderer: { path: string } | URL;
  readonly #openDevTools;
  #mainWindowId: number | null = null;

  constructor({
    initConfig,
    openDevTools = false,
  }: {
    initConfig: AppInitConfig;
    openDevTools?: boolean;
  }) {
    this.#preload = initConfig.preload;
    this.#renderer = initConfig.renderer;
    this.#openDevTools = openDevTools;
  }

  async enable({ app }: ModuleContext): Promise<void> {
    await app.whenReady();
    await this.createWindow();
    app.on("second-instance", () => this.restoreWindow());
    app.on("activate", () => this.restoreWindow());
  }

  // 在 createWindow 方法中添加默认值
  async createWindow(
    windowConfig: WindowConfig = {
      width: 1024,
      height: 768,
      resizable: true,
      frame: false,
      title: globalThis.appName,
      allowMultipleWindows: false,
      targetUrl:
        this.#renderer instanceof URL
          ? this.#renderer.href
          : this.#renderer.path
    }
  ): Promise<BrowserWindow> {

    const allowMultipleWindows = windowConfig?.allowMultipleWindows ?? false;

    if (!allowMultipleWindows) {
      const existingWindow = BrowserWindow.getAllWindows().find((window) => {
        const currentUrl = window.webContents.getURL();
        return currentUrl === windowConfig.targetUrl && !window.isDestroyed();
      });

      if (existingWindow) {
        this.restoreWindow(existingWindow?.id);
      }
    }

    const browserWindow = new BrowserWindow({
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      width: windowConfig?.width || 800,
      height: windowConfig?.height || 600,
      resizable: windowConfig?.resizable ?? true,
      title: windowConfig?.title || globalThis.appName,
      // 固定属性值
      frame: false, // 隐藏标题栏及控制按钮
      skipTaskbar: false,
      hasShadow: true,
      movable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      fullscreenable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: true,
        sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
        webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
        preload: this.#preload.path,
      },
    });

    // 新增：监听 ready-to-show 事件显示窗口
    browserWindow.once('ready-to-show', () => {
      browserWindow.show();
      if (this.#openDevTools) {
        browserWindow.webContents.openDevTools(); // 开发模式自动打开调试工具
      }
    });

    if (!windowConfig) {
      this.#mainWindowId = browserWindow.id;
    }

    if (this.#renderer instanceof URL) {
      await browserWindow.loadURL(this.#renderer.href);
    } else {
      await browserWindow.loadFile(this.#renderer.path);
    }

    return browserWindow;
  }

  async restoreWindow(id?: number) {
    let window;
    if (id) {
      window = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.id === id
      );
    } else {
      window = BrowserWindow.getAllWindows().find(
        (w) => !w.isDestroyed() && w.id === this.#mainWindowId
      );
    }

    if (!window) {
      return null;
    }

    if (window.isMinimized()) {
      window.restore();
    }

    window?.show();

    if (this.#openDevTools) {
      window?.webContents.openDevTools();
    }

    window.focus();

    return window;
  }

  /**
   * 修改已存在窗口的属性
   * @param windowId 窗口 ID
   * @param windowConfig 窗口配置
   */
  async updateWindowProperties(
    windowId: number,
    windowConfig: Partial<WindowConfig>
  ): Promise<boolean> {
    const window = BrowserWindow.fromId(windowId);

    if (!window || window.isDestroyed()) {
      return false;
    }

    if (windowConfig.width !== undefined && windowConfig.height !== undefined) {
      window.setSize(windowConfig.width, windowConfig.height);
    }

    if (windowConfig.alwaysOnTop !== undefined) {
      window.setAlwaysOnTop(windowConfig.alwaysOnTop);
    }
    if (windowConfig.focusable !== undefined) {
      window.setFocusable(windowConfig.focusable );
    }

    return true;
  }
}

export function createWindowManagerModule(
  ...args: ConstructorParameters<typeof WindowManager>
) {
  globalThis.windowManager = new WindowManager(...args);
  return globalThis.windowManager;
}