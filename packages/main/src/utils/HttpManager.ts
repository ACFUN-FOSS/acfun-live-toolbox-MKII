import http from "http";
import path from "path";
import fs from "fs/promises";  // 使用Promise版本的fs API
import url from "url";
import { ConfigManager } from "./ConfigManager.js";
import { app } from "electron";
import { getPackageJson } from "./Devars.js";

export class HttpManager {
  // 声明所有类属性（新增）
  private port: number;
  private apiRoutes: Map<string, any> = new Map();
  private staticMappings: Map<string, string> = new Map();
  private server: http.Server;
  private APP_DIR: string = '';  // 新增：应用目录路径
  private serverInitialized = false;  // 新增：服务器初始化状态
  private serverRunning = false;  // 新增：服务器运行状态
  private configManager: ConfigManager = globalThis.configManager;  // 新增：配置管理器实例

  constructor() {
    this.port = this.configManager.readConfig(undefined).port || 3000;
    this.server = http.createServer(this.handleRequest.bind(this));
    // 移除构造函数中的server.listen调用（改为通过initializeServer启动）
  }

  // 合并外部的handleRequest方法到类内部（关键修改）
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const parsedUrl = url.parse(req.url!, true);
      const pathname = parsedUrl.pathname || "";

      // -------------------- 修复：API路由匹配逻辑 --------------------
      // 遍历所有API路由前缀，查找匹配的路径
      const apiPrefix = Array.from(this.apiRoutes.keys()).find(prefix => 
        pathname.startsWith(prefix)
      );
      if (apiPrefix) {
        const apiPath = pathname.replace(apiPrefix, "").replace(/^\//, ""); // 提取API子路径
        const routes = this.apiRoutes.get(apiPrefix);
        if (routes && apiPath) {
          const handler = routes[apiPath];
          if (handler) {
            await handler(req, res);
            return;
          }
        }
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("API Not Found");
        return;
      }

      // -------------------- 修复：静态资源匹配逻辑 --------------------
      // 遍历所有静态资源前缀，查找匹配的路径
      const staticPrefix = Array.from(this.staticMappings.keys()).find(prefix => 
        pathname.startsWith(prefix)
      );
      if (staticPrefix) {
        const staticPath = pathname.replace(staticPrefix, "") || "index.html"; // 提取静态子路径
        const appDir = this.staticMappings.get(staticPrefix);
        if (appDir) {
          const filePath = path.join(appDir, staticPath);
          await this.serveStaticFile(filePath, res);
          return;
        }
      }

      // 通用404处理
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } catch (error) {
      console.error("请求处理失败:", error);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }

  // 新增：静态文件服务辅助方法（替代回调API）
  private async serveStaticFile(filePath: string, res: http.ServerResponse) {
    try {
      const stats = await fs.stat(filePath);
      let targetPath = filePath;
      
      if (stats.isDirectory()) {
        targetPath = path.join(filePath, "index.html");
        await fs.access(targetPath);  // 检查文件是否存在
      }

      const ext = path.extname(targetPath);
      const contentType = this.getContentType(ext);
      const fileData = await fs.readFile(targetPath);
      
      res.writeHead(200, { "Content-Type": contentType });
      res.end(fileData);
    } catch (error) {
      // 尝试回退到应用根目录的index.html
      const appRootIndex = path.join(this.APP_DIR, "index.html");
      try {
        const indexData = await fs.readFile(appRootIndex);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(indexData);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    }
  }

  // 保持原有方法定义（补充实现逻辑）
  serveStatic(pathPrefix: string, dir: string) {
    this.staticMappings.set(pathPrefix, dir);  // 存储静态资源映射
  }

  addApiRoutes(pathPrefix: string, routes: any) {
    this.apiRoutes.set(pathPrefix, routes);  // 存储API路由映射
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
        pkg.appPath ||  process.cwd()||path.dirname(app.getPath("exe")); // Fallback to current working directory
      this.APP_DIR = path.join(rootPath, "application");
    }

    if (this.serverRunning) {
      return { code: 200, msg: "服务器已在运行" };
    }

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
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

  // 新增：移除静态资源映射方法
  removeStatic(pathPrefix: string): void {
    this.staticMappings.delete(pathPrefix);  // 从Map中删除指定前缀
  }

  // 新增：移除API路由映射方法
  removeApiRoutes(pathPrefix: string): void {
    this.apiRoutes.delete(pathPrefix);  // 从Map中删除指定前缀
  }

  // Add public method to expose APP_DIR
  public getAppDir(): string {
    return this.APP_DIR;
  }
}

