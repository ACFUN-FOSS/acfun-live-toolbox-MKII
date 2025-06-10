import http from "http";
import path from "path";
import fs from "fs";
import url from "url";
import { ConfigManager } from "./ConfigManager.js";
import { app } from "electron";
// 导入 getPackageJson 函数
import { getPackageJson } from "./Devars.js";

// 创建 ConfigManager 实例
const configManager = new ConfigManager();
// 从配置中读取端口号
const PORT = configManager.readConfig(undefined).port || 3000;

// 判断是否为开发环境
let APP_DIR: string = "";

// 存储 API 路由
const apiRoutes = new Map<string, any>();

// 加载 API 接口
const loadApiRoutes = async (appPath: string) => {
  const apiFilePath = path.join(APP_DIR, appPath, "api.js");
  if (fs.existsSync(apiFilePath)) {
    try {
      // 使用动态 import 导入 api.js
      const apiModule = await import(`file://${apiFilePath}`);
      if (apiModule.default) {
        apiRoutes.set(appPath, apiModule.default);
      }
    } catch (error) {
      console.error(`加载 ${appPath} 的 API 接口失败:`, error);
    }
  }
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url!, true);
  const appPath = parsedUrl.pathname?.replace(/^\/application\//, "");

  if (!appPath) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
    return;
  }

  // 检查是否为 API 请求
  if (appPath.includes("/api/")) {
    const parts = appPath.split("/api/");
    const appName = parts[0];
    const apiPath = parts[1];
    const apiRoute = apiRoutes.get(appName);
    if (apiRoute) {
      const handler = apiRoute[apiPath];
      if (handler) {
        try {
          await handler(req, res);
          return;
        } catch (error) {
          console.error(`执行 ${appName} 的 API 接口 ${apiPath} 失败:`, error);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
          return;
        }
      }
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("API Not Found");
    return;
  }

  // 加载 API 接口
  await loadApiRoutes(appPath.split("/")[0]);

  const filePath = path.join(APP_DIR, appPath);

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // 处理单页面应用URL回退
      const indexPath = path.join(APP_DIR, appPath.split("/")[0], "index.html");
      fs.readFile(indexPath, (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(indexData);
        }
      });
      return;
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      fs.readFile(indexPath, (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(indexData);
        }
      });
    } else {
      const ext = path.extname(filePath);
      const contentType = getContentType(ext);

      fs.readFile(filePath, (fileErr, fileData) => {
        if (fileErr) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
        } else {
          res.writeHead(200, { "Content-Type": contentType });
          res.end(fileData);
        }
      });
    }
  });
});

const getContentType = (ext: string): string => {
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
};

// 添加状态标记
let serverInitialized = false;
let serverRunning = false;

// 封装初始化函数
// 添加返回类型注解，明确返回一个 Promise，包含 code 和 msg 的对象
export const initializeServer: () => Promise<{
  code: number;
  msg: string;
}> = async () => {
  if(!APP_DIR){
    const rootPath = (await getPackageJson()).appPath || app.getPath("exe");
    APP_DIR = path.join(rootPath, "application");
  }
  if (serverInitialized) {
    if (serverRunning) {
      console.log("Server is already running.");
      return { code: 200, msg: "服务器已在运行" };
    }
    console.log(
      "Server was previously initialized but not running. Attempting to start..."
    );
  }

  return new Promise((resolve) => {
    try {
      server.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}/application/`);
        serverInitialized = true;
        serverRunning = true;
        resolve({ code: 200, msg: "服务器启动成功" });
      });

      server.on("error", (err) => {
        console.error("Server initialization failed:", err);
        serverInitialized = false;
        serverRunning = false;
        const errorMessage = err instanceof Error ? err.message : "未知错误";
        resolve({ code: 500, msg: `服务器初始化失败: ${errorMessage}` });
      });
    } catch (err) {
      console.error(
        "An unexpected error occurred during server initialization:",
        err
      );
      serverInitialized = false;
      serverRunning = false;
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      resolve({
        code: 500,
        msg: `服务器初始化时发生意外错误: ${errorMessage}`,
      });
    }
  });
};

// 新增重启服务器函数
export const restartServer: () => Promise<{
  code: number;
  msg: string;
}> = async () => {
  if (!serverInitialized || !serverRunning) {
    return { code: 500, msg: "服务器未运行，无法重启" };
  }

  return new Promise((resolve) => {
    try {
      server.close((err) => {
        if (err) {
          console.error("服务器关闭失败:", err);
          serverRunning = false;
          const errorMessage = err instanceof Error ? err.message : "未知错误";
          resolve({ code: 500, msg: `服务器关闭失败: ${errorMessage}` });
          return;
        }

        serverRunning = false;
        console.log("服务器已关闭，准备重新启动...");

        initializeServer().then((result) => {
          resolve(result);
        });
      });
    } catch (err) {
      console.error("重启服务器时发生意外错误:", err);
      serverRunning = false;
      const errorMessage = err instanceof Error ? err.message : "未知错误";
      resolve({ code: 500, msg: `重启服务器时发生意外错误: ${errorMessage}` });
    }
  });
};

// 暴露初始化函数
export default {
  server,
  initializeServer,
  restartServer, // 导出重启函数
};