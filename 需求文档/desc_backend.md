
         
# ACFUN直播工具箱后端技术架构方案

## 一、整体架构概述

ACFUN直播工具箱采用分层架构设计，基于Electron框架实现跨平台支持。后端架构聚焦于稳定性、性能和可扩展性，采用模块化设计理念，将核心功能与扩展能力分离，主进程负责底层功能实现和资源管理，通过IPC与渲染进程通信。

### 1.1 架构分层
- **核心层**：包含应用基础模块、配置管理、日志系统等基础设施
- **服务层**：实现弹幕处理、推流管理、小程序系统等核心业务功能
- **API层**：提供统一的接口供渲染进程和小程序调用
- **通信层**：处理进程间通信、网络请求和实时数据流

### 1.2 技术栈
- 基础框架：Electron
- 语言：TypeScript
- 服务器：Express
- 进程通信：IPC、WebSocket、EventSource
- 数据存储：本地文件系统、electron-data

## 二、核心模块设计

### 2.1 应用生命周期管理

#### 2.1.1 模块系统
```typescript
// AppModule.ts - 应用模块接口定义
import type { ModuleContext } from './ModuleContext.js';
export interface AppModule {
    enable(context: ModuleContext): Promise<void> | void;
}
```

- `ModuleRunner` 负责初始化和管理所有应用模块，采用链式调用模式
- 关键模块：
  - `disallowMultipleAppInstance`：确保单实例运行
  - `terminateAppOnLastWindowClose`：窗口关闭时终止应用
  - `hardwareAccelerationMode`：硬件加速配置
  - `autoUpdater`：自动更新机制
  - `AcfunDanmuModule`：弹幕模块
  - `WindowManagerModule`：窗口管理

#### 2.1.2 初始化流程
```typescript
// index.ts - 应用初始化流程
export async function initApp(initConfig: AppInitConfig) {
    const moduleRunner = createModuleRunner()
        .init(disallowMultipleAppInstance())
        .init(terminateAppOnLastWindowClose())
        .init(hardwareAccelerationMode({ enable: true }))
        .init(autoUpdater())
        .init(createAcfunDanmuModule({ debug: process.env.NODE_ENV === 'development' }))

    // 初始化Electron API
    initializeElectronApi();

    // 延迟初始化WindowManager
    const windowManager = createWindowManagerModule({...});
    moduleRunner.init(windowManager);

    // 初始化全局管理器
    globalThis.configManager = new ConfigManager();
    globalThis.dataManager = DataManager.getInstance();
    globalThis.httpManager = new HttpManager();
    await globalThis.httpManager.initializeServer();
    globalThis.appManager = new AppManager();
    await globalThis.appManager.init();
    // ...
}
```

### 2.2 弹幕系统模块

#### 2.2.1 模块作用
弹幕系统模块是ACFUN直播工具箱的核心功能模块之一，主要负责处理ACFUN直播平台的弹幕数据，为直播互动提供基础支持。其核心作用包括：

1. **弹幕流处理**：通过EventSource或WebSocket与ACFUN服务器建立连接，实时获取弹幕数据，进行解析和处理
2. **弹幕过滤**：根据用户配置的过滤规则（关键词、黑名单等）对弹幕进行过滤，屏蔽不良信息
3. **弹幕展示控制**：提供弹幕显示参数的配置（速度、字体大小、颜色等），支持自定义弹幕样式
4. **弹幕数据管理**：收集和存储弹幕数据，为后续分析提供支持
5. **实时通知**：将处理后的弹幕数据实时推送给前端，确保观众互动的实时性
6. **高稳定性保障**：采用子进程模式运行，避免弹幕处理对主进程造成影响，确保系统稳定性

该模块直接满足了《需求文档》中主播用户"高效管理弹幕，过滤不良信息"的核心诉求，是实现良好直播互动体验的基础。

#### 2.2.2 架构设计
- 采用**子进程模式**运行，确保弹幕处理不影响主进程稳定性
- 支持**WebSocket和TCP**两种连接模式，提高连接可靠性
- 提供完整的**配置管理和日志收集机制**，方便问题排查和功能优化
- 实现**弹幕流处理、过滤、展示控制**一体化解决方案
- 基于**EventSource**实现单向实时数据流，减少资源消耗

#### 2.2.3 对外提供的HTTP接口
弹幕系统模块通过HTTP服务器提供以下接口供渲染进程调用：

1. **GET /api/danmu/config**
   - 作用：获取当前弹幕配置
   - 参数：无
   - 返回：弹幕配置对象（包含过滤规则、显示参数等）
   - 对应需求：3.8.5 弹幕流设置

2. **POST /api/danmu/config**
   - 作用：更新弹幕配置
   - 参数：
     ```json
     {
       "filterRules": ["关键词1", "关键词2"],  // 过滤关键词
       "display": {
         "speed": 100,  // 弹幕速度
         "fontSize": 16,  // 字体大小
         "color": "#FFFFFF"  // 字体颜色
       },
       "connection": {
         "timeout": 12000,  // 连接超时设置
         "reconnectInterval": 5000  // 重连间隔
       }
     }
     ```
   - 返回：{ success: boolean, message: string }
   - 对应需求：3.8.5 弹幕流设置

3. **GET /api/danmu/connect**
   - 作用：建立弹幕连接
   - 参数：
     - roomId: 房间ID
     - type: 连接类型（websocket/tcp）
   - 返回：{ success: boolean, message: string }
   - 对应需求：3.3.1 弹幕系统小程序（EventSource连接管理）

4. **GET /api/danmu/disconnect**
   - 作用：断开弹幕连接
   - 参数：无
   - 返回：{ success: boolean, message: string }
   - 对应需求：3.3.1 弹幕系统小程序

5. **GET /api/events/danmu**
   - 作用：获取实时弹幕流（SSE）
   - 参数：无
   - 返回：实时弹幕事件流
   - 对应需求：3.3.1 弹幕系统小程序（弹幕流处理、弹幕展示）

6. **POST /api/danmu/filter**
   - 作用：手动添加过滤关键词
   - 参数：{ keyword: string }
   - 返回：{ success: boolean, message: string }
   - 对应需求：3.8.5 弹幕流设置（配置弹幕过滤规则）

7. **DELETE /api/danmu/filter/:keyword**
   - 作用：删除过滤关键词
   - 参数：keyword: 关键词
   - 返回：{ success: boolean, message: string }
   - 对应需求：3.8.5 弹幕流设置

8. **GET /api/danmu/history**
   - 作用：获取历史弹幕
   - 参数：
     - roomId: 房间ID
     - limit: 获取数量
     - offset: 偏移量
   - 返回：{ success: boolean, data: DanmuEntry[] }
   - 对应需求：3.3.1 弹幕系统小程序

#### 2.2.4 核心实现
```typescript
// AcfunDanmuModule.ts - 弹幕模块实现
export class AcfunDanmuModule implements AppModule {
    private process: ChildProcess | null = null;
    private config: AcfunDanmuConfig;
    private logManager: ReturnType<typeof getLogManager>;
    private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

    constructor(config: Partial<AcfunDanmuConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logManager = getLogManager();
        // 注册配置变更监听
        globalThis.configManager.on('configChanged', (config) => {
            if (config.danmu) {
                this.config = { ...this.config, ...config.danmu };
                this.applyNewConfig();
            }
        });
    }

    // 启动弹幕服务
    private async start(): Promise<void> {
        // 确保之前的进程已关闭
        if (this.process) {
            this.stop();
        }

        this.connectionStatus = 'connecting';
        this.logManager.addLog('acfunDanmu', 'Starting danmu service', 'info');

        // 获取acfundanmu模块的路径
        const acfunDanmuPath = path.join(rootPath, 'packages', 'acfundanmu', 'main.js');

        // 准备启动参数
        const args = [
            acfunDanmuPath,
            '--roomId', this.config.roomId,
            '--connectionType', this.config.connectionType,
            '--debug', String(process.env.NODE_ENV === 'development')
        ];

        // 启动子进程
        this.process = spawn(process.execPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: false
        });

        // 捕获标准输出和错误
        this.process.stdout?.on('data', (data) => {
            const message = data.toString().trim();
            this.logManager.addLog('acfunDanmu', message, 'info');

            // 解析弹幕数据
            try {
                const danmuData = JSON.parse(message);
                // 过滤弹幕
                if (this.shouldFilterDanmu(danmuData)) {
                    return;
                }
                // 推送弹幕到前端
                globalThis.httpManager.publishEvent('danmu', danmuData);
            } catch (e) {
                // 非JSON数据，忽略
            }
        });

        this.process.stderr?.on('data', (data) => {
            const error = data.toString().trim();
            this.logManager.addLog('acfunDanmu', error, 'error');
        });

        this.process.on('close', (code) => {
            this.connectionStatus = 'disconnected';
            this.logManager.addLog('acfunDanmu', `Process closed with code ${code}`, 'info');

            // 自动重连机制
            if (this.config.autoReconnect && code !== 0) {
                setTimeout(() => {
                    this.start();
                }, this.config.reconnectInterval);
            }
        });

        this.connectionStatus = 'connected';
    }

    // 应用新配置
    private applyNewConfig(): void {
        // 向子进程发送配置更新消息
        if (this.process) {
            this.process.stdin?.write(JSON.stringify({
                type: 'configUpdate',
                config: this.config
            }) + '\n');
        }
    }

    // 弹幕过滤逻辑
    private shouldFilterDanmu(danmu: DanmuEntry): boolean {
        // 实现关键词过滤、黑名单过滤等逻辑
        const content = danmu.content.toLowerCase();
        return this.config.filterRules.some(rule => content.includes(rule.toLowerCase()));
    }

    // 停止弹幕服务
    private stop(): void {
        if (this.process) {
            this.process.kill();
            this.process = null;
            this.connectionStatus = 'disconnected';
            this.logManager.addLog('acfunDanmu', 'Danmu service stopped', 'info');
        }
    }

    // 实现AppModule接口
    enable(context: ModuleContext): void {
        this.start();

        // 注册HTTP API路由
        const router = express.Router();

        // 获取弹幕配置
        router.get('/config', (req, res) => {
            res.json({ success: true, data: this.config });
        });

        // 更新弹幕配置
        router.post('/config', (req, res) => {
            try {
                this.config = { ...this.config, ...req.body };
                this.applyNewConfig();
                // 保存配置
                globalThis.configManager.writeConfig({ danmu: this.config });
                res.json({ success: true, message: '配置更新成功' });
            } catch (error) {
                res.json({ success: false, error: '配置更新失败' });
            }
        });

        // 其他API路由实现...

        globalThis.httpManager.addApiRoutes('/api/danmu', router);
    }
}
```

#### 2.2.5 对应需求文档中的具体需求
- **3.3.1 弹幕系统小程序**：实现了弹幕流处理（EventSource连接管理、弹幕数据获取）、弹幕过滤、弹幕展示控制等核心功能
- **3.8.5 弹幕流设置**：提供了弹幕显示参数调整、过滤规则配置、EventSource连接设置等功能
- **4.3 弹幕管理流程**：支持配置过滤规则、调整显示样式、实时管理弹幕等操作流程
- **9.1 高优先级**：完成了弹幕基础功能（显示、过滤）的实现
- **9.2 中优先级**：支持高级弹幕功能（样式自定义、合并）
- **6.1 性能需求**：通过子进程隔离、连接池管理等方式，确保弹幕处理能力≥1000条/秒
- **10.1 功能验收**：弹幕显示准确率≥99%，过滤规则生效时间≤1秒

### 2.3 窗口管理

- 基于Electron BrowserWindow实现
- 支持多窗口管理和窗口间通信
- 延迟初始化机制确保IPC事件处理器已注册
- 窗口创建和配置分离，提高灵活性

### 2.4 应用管理

```typescript
// AppManager.ts - 应用管理器
export class AppManager extends EventEmitter {
    private apps: Map<string, AppConfig> = new Map();
    private appWindows: Map<string, Electron.BrowserWindow[]> = new Map();
    private httpManager: HttpManager = globalThis.httpManager;
    private windowManager: WindowManager = globalThis.windowManager;
    // ...

    async init(): Promise<void> {
        this.appDir = await this.getAppDirectory();
        const appFolders = await this.getAppFolders();
        for (const folder of appFolders) {
            // 加载应用配置
            const configPath = path.join(folder, "config.json");
            const configContent = await fs.promises.readFile(configPath, "utf-8");
            const config: AppConfig = JSON.parse(configContent);
            this.apps.set(config.id, config);
            // ...
        }
    }
    // ...
}
```

## 三、通信机制设计

### 3.1 进程间通信

- 使用Electron的`ipcMain`和`ipcRenderer`实现主进程与渲染进程通信
- 定义标准化的API接口，支持异步调用和错误处理

```typescript
// electronApi.ts - IPC API实现
export function initializeElectronApi() {
    // Acfun弹幕模块相关API
    ipcMain.handle('acfunDanmu:start', async () => {
        try {
            await acfunDanmuModule.start();
            return { success: true };
        } catch (error) {
            console.error('Error starting acfun danmu module:', error);
            return { success: false, error: 'Failed to start acfun danmu module' };
        }
    });

    // 停止Acfun弹幕模块
    ipcMain.handle('acfunDanmu:stop', async () => {
        try {
            await acfunDanmuModule.stop();
            return { success: true };
        } catch (error) {
            // ...
        }
    });
    // ...
}
```

### 3.2 实时数据流

- 使用`EventSource`实现单向实时数据流（如弹幕流）
- 支持心跳机制和断线重连策略
- 基于HTTP长连接，减少资源消耗

```typescript
// HttpManager.ts - EventSource支持
export class HttpManager {
    private eventSourceConnections: Map<string, EventSourceConnection[]> = new Map();

    private setupEventRoutes() {
        // 设置SSE路由
        this.expressApp.get('/api/events/:type', (req, res) => {
            // 设置SSE响应头
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            const eventType = req.params.type;
            const connection: EventSourceConnection = { res, subscriptionType: eventType };

            // 存储连接
            if (!this.eventSourceConnections.has(eventType)) {
                this.eventSourceConnections.set(eventType, []);
            }
            this.eventSourceConnections.get(eventType)?.push(connection);

            // 客户端关闭连接时清理
            req.on('close', () => {
                // 移除连接
                // ...
            });
        });
    }

    // 发送事件到所有订阅者
    publishEvent(eventType: string, data: any) {
        const connections = this.eventSourceConnections.get(eventType) || [];
        connections.forEach(connection => {
            connection.res.write(`data: ${JSON.stringify(data)}

`);
        });
    }
    // ...
}
```

## 四、存储系统设计

### 4.1 配置管理

- 基于`electron-data`实现跨平台配置存储
- 支持配置文件备份和恢复
- 配置变更实时生效机制

```typescript
// ConfigManager.ts - 配置管理器
class ConfigManager {
    private configPath: string;
    private DEFAULT_CONFIG_PATH: string;

    constructor(customPath?: string) {
        this.DEFAULT_CONFIG_PATH = join(homedir(), globalThis.appName);
        
        // 初始化electron-data配置
        electron_data.config({
            filename: globalThis.appName,
            path: customPath || this.DEFAULT_CONFIG_PATH,
            autosave: true,
            prettysave: true
        });

        this.configPath = customPath || this.DEFAULT_CONFIG_PATH;
        this.ensureConfigDirectoryExists();
        this.initializeConfig().catch(err => console.error('配置初始化失败:', err));
    }
    // ...
}
```

### 4.2 日志系统

- 基于`EventEmitter`实现的日志管理器
- 支持多来源日志分类管理
- 文件日志和内存日志双存储机制
- 日志级别控制（info、debug、error、warn）

```typescript
// LogManager.ts - 日志管理器
export class LogManager extends EventEmitter {
    private logs: Map<string, LogEntry[]> = new Map();
    private maxLogEntries: number = 1000;
    private logFilePath: string;

    constructor() {
        super();
        // 创建日志目录
        const logDir = path.join(app.getPath('userData'), 'logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        // 设置日志文件路径
        this.logFilePath = path.join(logDir, 'app.log');
    }

    // 添加日志条目
    addLog(source: string, message: string, level: LogLevel = 'info'): void {
        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            source,
            message
        };

        // 确保源存在于logs映射中
        if (!this.logs.has(source)) {
            this.logs.set(source, []);
        }

        // 添加日志条目
        const sourceLogs = this.logs.get(source)!;
        sourceLogs.push(entry);

        // 限制日志数量
        if (sourceLogs.length > this.maxLogEntries) {
            sourceLogs.shift();
        }

        // 写入文件
        this.writeLogToFile(entry);

        // 触发日志添加事件
        this.emit('logAdded', entry);
    }
    // ...
}
```

### 4.3 数据管理

- 单例模式实现的数据管理器
- 支持应用数据的CRUD操作
- 数据变更通知机制
- 内存缓存与持久化存储结合

## 五、HTTP服务器与API设计

### 5.1 服务器架构

- 基于Express实现的轻量级HTTP服务器
- 支持静态资源托管和API路由
- 动态路由注册机制，支持模块化扩展

```typescript
// HttpManager.ts - HTTP服务器管理
export class HttpManager {
    private port: number;
    private expressApp: express.Application = express();
    private staticMappings: Map<string, string> = new Map();
    private apiRoutes: Map<string, express.Router> = new Map();
    private server: http.Server | undefined;

    constructor() {
        this.port = this.configManager.readConfig(undefined).port || 3000;
        this.expressApp.use(express.json());
        this.setupEventRoutes();
    }

    // 服务静态资源
    serveStatic(pathPrefix: string, dir: string) {
        this.staticMappings.set(pathPrefix, dir);
        this.rebuildExpressApp();
    }

    // 添加API路由
    addApiRoutes(prefix: string, router: express.Router): void {
        console.log(`Mounting API routes at prefix: ${prefix}`);
        this.apiRoutes.set(prefix, router);
        this.expressApp.use(prefix, router);
    }

    // 初始化服务器
    async initializeServer(): Promise<void> {
        if (this.serverInitialized) {
            return;
        }

        // 从配置获取端口
        const configPort = this.configManager.readConfig(undefined).port;
        if (configPort) {
            this.port = configPort;
        }

        // 启动HTTP服务器
        return new Promise((resolve, reject) => {
            this.server = this.expressApp.listen(this.port, () => {
                console.log(`HTTP server started on port ${this.port}`);
                this.serverInitialized = true;
                this.serverRunning = true;
                resolve();
            }).on('error', (err) => {
                console.error('Failed to start HTTP server:', err);
                reject(err);
            });
        });
    }
    // ...
}
```

### 5.2 API设计原则

-  RESTful API设计风格
-  统一的响应格式（{ success: boolean, data?: any, error?: string }）
-  完善的错误处理
-  权限验证机制

## 六、性能优化策略

### 6.1 资源管理
- 子进程隔离CPU密集型任务（如弹幕处理）
- 延迟加载非核心模块
- 资源使用限制（内存、CPU）

### 6.2 网络优化
- 请求合并减少网络往返
- 数据缓存策略
- 长连接复用

### 6.3 渲染优化
- 避免不必要的UI更新
- 虚拟列表处理大数据渲染
- 图片懒加载和压缩

## 七、安全性设计

### 7.1 进程隔离
- 主进程与渲染进程严格隔离
- 小程序运行在独立沙箱中
- 权限控制机制限制API访问

### 7.2 数据安全
- 敏感数据加密存储
- 直播码定期刷新
- 输入验证和过滤

### 7.3 通信安全
- IPC通信权限验证
- 网络请求HTTPS加密
- 防注入攻击措施

## 八、扩展性设计

### 8.1 模块系统
- 标准化的`AppModule`接口
- 动态模块加载机制
- 模块依赖管理

### 8.2 小程序架构
- 小程序运行时环境
- 标准化通信接口
- 资源限制和安全沙箱

### 8.3 插件系统
- 插件注册机制
- 钩子函数扩展点
- 插件生命周期管理

## 九、部署与构建

### 9.1 构建流程
- TypeScript编译
- 资源打包
- 代码压缩和优化

### 9.2 自动更新
- 增量更新机制
- 更新检测和通知
- 回滚策略

### 9.3 版本管理
- 语义化版本控制
- 版本兼容性保证
- 版本发布流程

通过以上架构设计，ACFUN直播工具箱后端系统能够提供稳定、高效、安全的服务，同时保持良好的可扩展性和可维护性，为前端提供强大的支持。