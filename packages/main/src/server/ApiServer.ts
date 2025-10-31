import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer, Server } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WsHub } from './WsHub';
import { QueryService, EventQuery } from '../persistence/QueryService';
import { CsvExporter, ExportOptions } from '../persistence/CsvExporter';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { DiagnosticsService } from '../logging/DiagnosticsService';
import { NormalizedEventType } from '../types';

/**
 * API 服务器配置
 */
export interface ApiServerConfig {
  port: number;
  host?: string;
  enableCors?: boolean;
  enableHelmet?: boolean;
  enableCompression?: boolean;
  enableLogging?: boolean;
}

/**
 * Manages the local HTTP and WebSocket server.
 */
export class ApiServer {
  private app: express.Application;
  private server: Server | null = null;
  private wsHub: WsHub;
  private config: ApiServerConfig;
  private queryService: QueryService;
  private csvExporter: CsvExporter;
  private diagnosticsService: DiagnosticsService;
  private pluginRoutes: Map<string, { method: 'GET' | 'POST'; path: string; handler: express.RequestHandler }[]> = new Map();

  constructor(config: ApiServerConfig = { port: 1299 }, databaseManager: DatabaseManager, diagnosticsService: DiagnosticsService) {
    this.config = {
      host: '127.0.0.1',
      enableCors: true,
      enableHelmet: true,
      enableCompression: true,
      enableLogging: true,
      ...config
    };

    this.app = express();
    this.wsHub = new WsHub();
    this.queryService = new QueryService(databaseManager);
    this.csvExporter = new CsvExporter(this.queryService);
    this.diagnosticsService = diagnosticsService;
    
    this.configureMiddleware();
    this.configureRoutes();
    this.configureErrorHandling();
  }

  /**
   * 配置中间件
   */
  private configureMiddleware(): void {
    // 安全中间件
    if (this.config.enableHelmet) {
      this.app.use(helmet({
        contentSecurityPolicy: false, // 允许内联脚本，适用于 Electron 应用
        crossOriginEmbedderPolicy: false
      }));
    }

    // CORS 中间件
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: true, // 允许所有来源，适用于本地开发
        credentials: true
      }));
    }

    // 压缩中间件
    if (this.config.enableCompression) {
      this.app.use(compression());
    }

    // 日志中间件
    if (this.config.enableLogging) {
      this.app.use(morgan('combined'));
    }

    // 解析中间件
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  /**
   * 配置路由
   */
  private configureRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', (req: express.Request, res: express.Response) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        websocket_clients: this.wsHub?.getClientCount() || 0
      });
    });

    // GET /api/events - 查询分页事件
    this.app.get('/api/events', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const query: EventQuery = {
          room_id: req.query.room_id as string,
          from_ts: req.query.from_ts ? parseInt(req.query.from_ts as string) : undefined,
          to_ts: req.query.to_ts ? parseInt(req.query.to_ts as string) : undefined,
          type: req.query.type as NormalizedEventType,
          user_id: req.query.user_id as string,
          q: req.query.q as string,
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 200
        };

        // 验证参数
        if (query.pageSize && (query.pageSize < 1 || query.pageSize > 1000)) {
          return res.status(400).json({
            error: 'Invalid pageSize. Must be between 1 and 1000.'
          });
        }

        if (query.page && query.page < 1) {
          return res.status(400).json({
            error: 'Invalid page. Must be >= 1.'
          });
        }

        const result = await this.queryService.queryEvents(query);
        res.json(result);
      } catch (error) {
        next(error);
      }
    });

    // GET /api/stats/events - 聚合事件统计
    this.app.get('/api/stats/events', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const roomId = (req.query.room_id as string) || undefined;
        const stats = await this.queryService.getEventStats(roomId);
        res.json({ success: true, ...stats });
      } catch (error) {
        next(error);
      }
    });

    // GET /api/diagnostics - 生成诊断包
    this.app.get('/api/diagnostics', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const zipPath = await this.diagnosticsService.generateDiagnosticPackage();
        const stat = fs.statSync(zipPath);
        const filename = path.basename(zipPath);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stat.size);

        const stream = fs.createReadStream(zipPath);
        stream.on('error', (err) => next(err));
        stream.pipe(res);
      } catch (error) {
        next(error);
      }
    });

    // GET /api/logs - 获取最近的日志
    this.app.get('/api/logs', (req: express.Request, res: express.Response) => {
      try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
        const level = req.query.level as string;
        
        const logs = this.diagnosticsService.getRecentLogs(limit, level);
        res.json({
          logs,
          total: logs.length,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve logs' });
      }
    });

    // POST /api/export - 触发 CSV 导出
    this.app.post('/api/export', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const options: ExportOptions = {
          room_id: req.body.room_id,
          from_ts: req.body.from_ts,
          to_ts: req.body.to_ts,
          type: req.body.type,
          filename: req.body.filename,
          includeRaw: req.body.includeRaw || false
        };

        const result = await this.csvExporter.exportToCsv(options);
        
        res.json({
          success: true,
          filename: result.filename,
          filepath: result.filepath,
          recordCount: result.recordCount,
          fileSize: result.fileSize
        });
      } catch (error) {
        next(error);
      }
    });

    // GET /console - LAN 控制台
    this.app.get('/console', (req: express.Request, res: express.Response) => {
      // TODO: 实现 LAN 控制台页面
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>AcFun Live Toolbox - Console</title>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { border-bottom: 1px solid #ccc; padding-bottom: 20px; }
            .status { margin: 20px 0; }
            .placeholder { color: #666; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AcFun Live Toolbox Console</h1>
            <p>Local Area Network Management Interface</p>
          </div>
          <div class="status">
            <h2>Server Status</h2>
            <p>✅ HTTP Server: Running</p>
            <p>✅ WebSocket Server: ${this.wsHub?.getClientCount() || 0} clients connected</p>
          </div>
          <div class="placeholder">
            <p>Console interface is under development...</p>
            <p>API Endpoints:</p>
            <ul>
              <li>GET /api/events - Query events</li>
              <li>POST /api/export - Export to CSV</li>
              <li>GET /api/diagnostics - Download diagnostic package</li>
              <li>GET /api/logs - Get recent logs</li>
              <li>GET /api/health - Health check</li>
            </ul>
          </div>
        </body>
        </html>
      `);
    });

    // GET /plugins/:id/:rest* - 插件页面托管（Express v5/path-to-regexp@v6 需要命名通配符）
    this.app.all('/plugins/:id/(.*)', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const pluginId = req.params.id;
      const reqPath = `/${(req.params as any)[0] || ''}`; // path within plugin scope

      // 路由命中检查（只匹配已注册的前缀路径）
      const routes = this.pluginRoutes.get(pluginId) || [];
      const method = req.method.toUpperCase() as 'GET' | 'POST';
      const candidate = routes.find(r => r.method === method && reqPath.startsWith(r.path));

      if (!candidate) {
        // 静态托管后续实现，此处返回 404
        return res.status(404).json({
          error: 'PLUGIN_ROUTE_NOT_FOUND',
          pluginId,
          path: reqPath,
          method
        });
      }

      // 调用已注册处理器；确保插件无法逃逸作用域
      try {
        candidate.handler(req, res, next);
      } catch (err) {
        console.error('[ApiServer] Plugin route handler error:', err);
        res.status(500).json({ error: 'PLUGIN_HANDLER_ERROR' });
      }
    });

    // GET /overlay/:overlayId - Overlay 入口
    this.app.get('/overlay/:overlayId', (req: express.Request, res: express.Response) => {
      const overlayId = req.params.overlayId;
      const room = req.query.room as string;
      const token = req.query.token as string;
      
      // TODO: 实现 Overlay 页面
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Overlay - ${overlayId}</title>
          <meta charset="utf-8">
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              background: transparent;
            }
            .overlay-info {
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 10px;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <div class="overlay-info">
            <h3>Overlay: ${overlayId}</h3>
            <p>Room: ${room || 'Not specified'}</p>
            <p>Status: Under development</p>
          </div>
        </body>
        </html>
      `);
    });

    // 404 handler（Express v5 推荐不传路径）
    this.app.use((req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.originalUrl
      });
    });
  }

  /**
   * 配置错误处理
   */
  private configureErrorHandling(): void {
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('[ApiServer] Error:', err);
      
      res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });
  }

  /**
   * 获取 WebSocket Hub 实例
   */
  public getWsHub(): WsHub {
    return this.wsHub;
  }

  /**
   * 获取 Express 应用实例
   */
  public getApp(): express.Application {
    return this.app;
  }

  /**
   * 由 PluginManager/ApiBridge 调用，为插件注册 HTTP 路由。
   * 路由仅在 `/plugins/:id/*` 作用域下可达。
   */
  public registerPluginRoute(
    pluginId: string,
    def: { method: 'GET' | 'POST'; path: string },
    handler: express.RequestHandler
  ): void {
    if (!/^[a-zA-Z0-9_]+$/.test(pluginId)) {
      throw new Error('INVALID_PLUGIN_ID');
    }
    if (!/^[\/a-zA-Z0-9_\-]*$/.test(def.path)) {
      throw new Error('INVALID_ROUTE_PATH');
    }
    const list = this.pluginRoutes.get(pluginId) || [];
    list.push({ method: def.method, path: def.path || '/', handler });
    this.pluginRoutes.set(pluginId, list);
    console.log(`[ApiServer] Registered plugin route: [${def.method}] /plugins/${pluginId}${def.path}`);
  }

  /**
   * 启动服务器
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer(this.app);
        console.log(`[ApiServer] HTTP server created, starting listen on ${this.config.host}:${this.config.port}`);

        this.server.listen(this.config.port, this.config.host, () => {
          console.log(`[ApiServer] HTTP server running at http://${this.config.host}:${this.config.port}`);
          try {
            // 初始化 WebSocket 服务器在 HTTP 监听成功后，避免底层 zlib/网络栈异常
            this.wsHub.initialize(this.server!);
            console.log(`[ApiServer] WebSocket server started`);
          } catch (err) {
            console.error('[ApiServer] WebSocket initialization failed:', err);
          }
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('[ApiServer] Server error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('[ApiServer] Start failed:', error);
        reject(error);
      }
    });
  }

  /**
   * 停止服务器
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      console.log('[ApiServer] Shutting down server...');
      
      // 关闭 WebSocket Hub
      this.wsHub.close();

      if (this.server) {
        this.server.close(() => {
          console.log('[ApiServer] Server closed');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 获取服务器状态
   */
  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }
}
