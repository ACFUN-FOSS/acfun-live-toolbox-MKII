import { BrowserWindow } from 'electron';

/**
 * 模块上下文接口
 * 提供模块所需的应用全局资源
 */
export interface ModuleContext {
  /** 主窗口实例 */
  mainWindow: BrowserWindow;
  /** 应用数据目录路径 */
  appDataPath: string;
  /** 应用版本号 */
  appVersion: string;
  /** 模块配置存储 */
  configStore: Map<string, any>;
}