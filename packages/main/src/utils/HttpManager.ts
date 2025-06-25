import http from "http";
import path from "path";
import fs from "fs/promises"; // 使用Promise版本的fs API
import url from "url";
import { app } from "electron";
import { getPackageJson } from "./Devars.js";
import express from "express";

// 新增：事件源连接接口
export interface EventSourceConnection {
  res: express.Response;
  subscriptionType: string;
}

export class HttpManager {
  // 声明所有类属性（新增）
  private port: number;
  private expressApp: express.Application = express();
  private staticMappings: Map<string, string> = new Map();
  private apiRoutes: Map<string, express.Router> = new Map();
  private server: http.Server | undefined;
  private APP_DIR: string = ""; // 新增：应用目录路径
  private serverInitialized = false; // 新增：服务器初始化状态
  private serverRunning = false; // 新增：服务器运行状态
  private configManager: any = globalThis.configManager; // 新增：配置管理器实例
  private dataManager: any = globalThis.dataManager; // 新增：数据管理器实例
  private eventSourceConnections: Map<string, EventSourceConnection[]> = new Map(); // 更新类型声明

  constructor() {
    this.port = this.configManager.readConfig(undefined).port || 3000;
    this.expressApp.use(express.json()); // 添加JSON解析中间件
    this.setupEventRoutes(); // 新增：设置事件相关路由
    // 移除手动创建的HTTP服务器
  }

  // 保持原有方法定义（补充实现逻辑）
  serveStatic(pathPrefix: string, dir: string) {
    this.staticMappings.set(pathPrefix, dir); // 存储静态资源映射
    this.rebuildExpressApp(); // 重建Express应用以应用新的静态映射
  }

  // 修复找不到 ExpressRouter 名称的问题，推测应该使用 express.Router 类型
  addApiRoutes(prefix: string, router: express.Router): void {
    console.log(`Mounting API routes at prefix: ${prefix}`);
    this.apiRoutes.set(prefix, router);
    this.expressApp.use(prefix, router);
  }

  removeApiRoutes(prefix: string): void {
    if (this.apiRoutes.has(prefix)) {
      this.apiRoutes.delete(prefix);
      this.rebuildExpressApp();
    }
  }

  private rebuildExpressApp(): void {
    const newApp = express();
    newApp.use(express.json());

    this.apiRoutes.forEach((router, prefix) => {
      newApp.use(prefix, router);
    });

    // 添加静态文件服务中间件
    this.staticMappings.forEach((dir, prefix) => {
      newApp.use(
        prefix,
        express.static(dir, {
          fallthrough: false, // 不允许回退，由后续中间件处理
          index: "index.html",
        })
      );
    });

    // 添加404处理中间件
    newApp.use((req, res) => {
      res.status(404).send("Not Found");
    });

    this.expressApp = newApp;
  }

  // 新增：类型辅助方法（原getContentType改为类方法）
  private getContentType(ext: string): string {
    const contentTypes: { [key: string]: string } = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".woff": "application/font-woff",
      ".ttf": "application/font-ttf",
      ".eot": "application/vnd.ms-fontobject",
      ".otf": "application/font-otf",
      ".wasm": "application/wasm",
    };
    return contentTypes[ext] || "application/octet-stream";
  }

  // 重构初始化方法（关键修改）
  public async initializeServer(): Promise<{ code: number; msg: string }> {
    if (!this.APP_DIR) {
      // Add fallback to current working directory if both values are undefined
      const pkg = await getPackageJson();
      const rootPath =
        pkg.appPath || process.cwd() || path.dirname(app.getPath("exe")); // Fallback to current working directory
      this.APP_DIR = path.join(rootPath, "application");

      // 检查并创建应用目录
      try {
        await fs.access(this.APP_DIR);
      } catch {
        await fs.mkdir(this.APP_DIR, { recursive: true });
        console.log(`创建应用目录: ${this.APP_DIR}`);
      }
    }

    if (this.serverRunning) {
      return { code: 200, msg: "服务器已在运行" };
    }

    return new Promise((resolve) => {
      // 使用Express应用直接监听端口
      this.server = this.expressApp.listen(this.port, () => {
        this.serverInitialized = true;
        this.serverRunning = true;
        resolve({ code: 200, msg: "服务器启动成功" });
      });

      this.server.on("error", (err) => {
        this.serverInitialized = false;
        this.serverRunning = false;
        const errorMessage = err instanceof Error ? err.message : "未知错误";
        resolve({ code: 500, msg: `服务器初始化失败: ${errorMessage}` });
      });
    });
  }

  // 重构重启方法（关键修改）
  public async restartServer(): Promise<{ code: number; msg: string }> {
    if (!this.serverRunning) {
      return { code: 500, msg: "服务器未运行，无法重启" };
    }

    return new Promise((resolve) => {
      if (!this.server) {
        resolve({ code: 500, msg: "服务器实例不存在，无法关闭并重启" });
        return;
      }
      this.server.close(async (err) => {
        if (err) {
          this.serverRunning = false;
          const errorMessage = err instanceof Error ? err.message : "未知错误";
          resolve({ code: 500, msg: `服务器关闭失败: ${errorMessage}` });
          return;
        }

        this.serverRunning = false;
        console.log("服务器已关闭，准备重新启动...");
        const result = await this.initializeServer();
        resolve(result);
      });
    });
  }

  getPort(): number {
    return this.port;
  }

  // 新增：设置事件相关路由
  private setupEventRoutes(): void {
    const eventRouter = express.Router();

    // 发布数据的API端点
    eventRouter.post('/publish', async (req, res): Promise<void> => {
      try {
        const { topic, data, publisher } = req.body;
        if (!topic || !publisher) {
          res.status(400).json({ error: 'Missing required parameters: topic and publisher are required' });
          return;
        }
        const result = this.dataManager.publish(topic, data, publisher);
        res.json({ success: result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to publish data' });
      }
    });

    // 添加连接关闭清理端点
    eventRouter.get('/unsubscribe', async (req, res): Promise<void> => {
      try {
        const { type, topic } = req.query;
        
        if (!type || !['obs', 'main'].includes(type as string)) {
          res.status(400).json({ error: 'Invalid or missing type parameter' });
          return;
        }
    
        if (topic) {
          // 清理特定主题的指定类型订阅
          this.dataManager.cleanupByTypeAndTopic(type as 'obs' | 'main', topic as string);
        } else {
          // 清理所有主题的指定类型订阅
          this.dataManager.handleConnectionClosed(type as 'obs' | 'main');
        }
    
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to unsubscribe' });
      }
    });

    // EventSource订阅端点
    eventRouter.get('/subscribe/:topic', (req, res) => {
      const topic = req.params.topic;
      const { type } = req.query;
      
      // 验证类型参数
      if (!type || !['obs', 'main', 'client'].includes(type as string)) {
        res.status(400).json({ error: 'Invalid or missing subscription type' });
        return;
      }
      
      // 设置SSE响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
  
      // 生成唯一订阅者ID
      const subscriberId = `http:${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
      // 存储连接及类型信息
      if (!this.eventSourceConnections.has(topic)) {
        this.eventSourceConnections.set(topic, []);
      }
      this.eventSourceConnections.get(topic)!.push({ res, subscriptionType: type as string });
  
      // 订阅数据更新，传递类型参数
      this.dataManager.subscribe(topic, subscriberId, type as string, (dataItem: any) => {
        try {
          // 发送SSE事件
          res.write(`data: ${JSON.stringify(dataItem)} 

`);
        } catch (error) {
          console.error('Failed to send SSE event:', error);
        }
      });
  
      // 处理连接关闭
      req.on('close', () => {
        // 取消订阅
        this.dataManager.unsubscribe(topic, subscriberId);
        // 根据类型清理订阅
        if (['obs', 'main'].includes(type as string)) {
          this.dataManager.handleConnectionClosed(type as 'obs' | 'main');
        }
        // 移除连接
        const connections = this.eventSourceConnections.get(topic);
        if (connections) {
          this.eventSourceConnections.set(topic, connections.filter(conn => conn.res !== res));
          if (this.eventSourceConnections.get(topic)!.length === 0) {
            this.eventSourceConnections.delete(topic);
          }
        }
        res.end();
      });
    });

    // 添加事件路由到API
    this.addApiRoutes('/events', eventRouter);
  }

  // 新增：移除静态资源映射方法
  removeStatic(pathPrefix: string): void {
    this.staticMappings.delete(pathPrefix); // 从Map中删除指定前缀
  }

  // Add public method to expose APP_DIR
  public getAppDir(): string {
    return this.APP_DIR;
  }
}
