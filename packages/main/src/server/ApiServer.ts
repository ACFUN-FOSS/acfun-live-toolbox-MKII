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
import { OverlayManager } from '../plugins/OverlayManager';
import { ConsoleManager } from '../console/ConsoleManager';
import { AcfunApiProxy } from './AcfunApiProxy';
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
  private overlayManager: OverlayManager;
  private consoleManager: ConsoleManager;
  private acfunApiProxy: AcfunApiProxy;
  private pluginRoutes: Map<string, { method: 'GET' | 'POST'; path: string; handler: express.RequestHandler }[]> = new Map();

  constructor(config: ApiServerConfig = { port: 1299 }, databaseManager: DatabaseManager, diagnosticsService: DiagnosticsService, overlayManager: OverlayManager, consoleManager: ConsoleManager) {
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
    this.overlayManager = overlayManager;
    this.consoleManager = consoleManager;
    this.acfunApiProxy = new AcfunApiProxy();

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
    // Root endpoint - API server info
    this.app.get('/', (req: express.Request, res: express.Response) => {
      res.json({
        name: 'ACFun Live Toolbox API Server',
        status: 'running',
        version: '1.0.0',
        websocket_clients: this.wsHub?.getClientCount() || 0,
        websocket_endpoint: `ws://127.0.0.1:${this.config.port}`,
        endpoints: {
          api: [
            { method: 'GET', path: '/api/health', description: 'Server health check' },
            { method: 'GET', path: '/api/events', description: 'Query events with pagination' },
            { method: 'GET', path: '/api/stats/events', description: 'Event statistics' },
            { method: 'GET', path: '/api/diagnostics', description: 'System diagnostics' },
            { method: 'GET', path: '/api/logs', description: 'Application logs' },
            { method: 'POST', path: '/api/export', description: 'Export data to CSV' }
          ],
          acfun: [
            { method: 'ALL', path: '/api/acfun/*', description: 'AcFun Live API proxy endpoints' },
            // 认证相关
            { method: 'GET', path: '/api/acfun/auth/status', description: 'Check authentication status' },
            { method: 'POST', path: '/api/acfun/auth/qr-login', description: 'Start QR code login' },
            { method: 'GET', path: '/api/acfun/auth/qr-status', description: 'Check QR code login status' },
            { method: 'POST', path: '/api/acfun/auth/token', description: 'Set authentication token' },
            { method: 'DELETE', path: '/api/acfun/auth/token', description: 'Clear authentication token' },
            // 用户相关
            { method: 'GET', path: '/api/acfun/user/info', description: 'Get user information' },
            { method: 'GET', path: '/api/acfun/user/wallet', description: 'Get user wallet information' },
            // 弹幕相关
            { method: 'POST', path: '/api/acfun/danmu/start', description: 'Start danmu session' },
            { method: 'POST', path: '/api/acfun/danmu/stop', description: 'Stop danmu session' },
            { method: 'GET', path: '/api/acfun/danmu/room-info', description: 'Get live room information' },
            // 直播相关
            { method: 'GET', path: '/api/acfun/live/permission', description: 'Check live permission' },
            { method: 'GET', path: '/api/acfun/live/stream-url', description: 'Get stream URL' },
            { method: 'GET', path: '/api/acfun/live/stream-settings', description: 'Get stream settings' },
            { method: 'GET', path: '/api/acfun/live/stream-status', description: 'Get stream status' },
            { method: 'POST', path: '/api/acfun/live/start', description: 'Start live stream' },
            { method: 'POST', path: '/api/acfun/live/stop', description: 'Stop live stream' },
            { method: 'PUT', path: '/api/acfun/live/update', description: 'Update live room settings' },
            { method: 'GET', path: '/api/acfun/live/statistics', description: 'Get live statistics' },
            { method: 'GET', path: '/api/acfun/live/summary', description: 'Get live summary' },
            { method: 'GET', path: '/api/acfun/live/hot-lives', description: 'Get hot live list' },
            { method: 'GET', path: '/api/acfun/live/categories', description: 'Get live categories' },
            { method: 'GET', path: '/api/acfun/live/user-info', description: 'Get user live info' },
            { method: 'GET', path: '/api/acfun/live/clip-permission', description: 'Get clip permission' },
            { method: 'PUT', path: '/api/acfun/live/clip-permission', description: 'Set clip permission' },
            // 礼物相关
            { method: 'GET', path: '/api/acfun/gift/all', description: 'Get all gift list' },
            { method: 'GET', path: '/api/acfun/gift/live', description: 'Get live gift list' },
            // 房管相关
            { method: 'GET', path: '/api/acfun/manager/list', description: 'Get manager list' },
            { method: 'POST', path: '/api/acfun/manager/add', description: 'Add manager' },
            { method: 'DELETE', path: '/api/acfun/manager/remove', description: 'Remove manager' },
            { method: 'GET', path: '/api/acfun/manager/kick-records', description: 'Get kick records' },
            { method: 'POST', path: '/api/acfun/manager/kick', description: 'Kick user' },
            // 权限管理相关
            { method: 'GET', path: '/api/acfun/permissions/plugins', description: 'Get all plugin permissions' },
            { method: 'POST', path: '/api/acfun/permissions/plugins', description: 'Set plugin permission' },
            { method: 'GET', path: '/api/acfun/permissions/plugins/:pluginId', description: 'Get specific plugin permission' },
            { method: 'DELETE', path: '/api/acfun/permissions/plugins/:pluginId', description: 'Remove plugin permission' },
            { method: 'GET', path: '/api/acfun/permissions/api-endpoints', description: 'Get API endpoint permissions' },
            { method: 'POST', path: '/api/acfun/permissions/check', description: 'Check permission for plugin and endpoint' },
            { method: 'POST', path: '/api/acfun/permissions/rate-limit/reset', description: 'Reset rate limit for plugin' }
          ],
          console: [
            { method: 'GET', path: '/api/console/data', description: 'Get console page data' },
            { method: 'POST', path: '/api/console/sessions', description: 'Create console session' },
            { method: 'GET', path: '/api/console/sessions', description: 'List console sessions' },
            { method: 'DELETE', path: '/api/console/sessions/:id', description: 'Delete console session' },
            { method: 'POST', path: '/api/console/sessions/:id/execute', description: 'Execute console command' },
            { method: 'GET', path: '/api/console/commands', description: 'Get available commands' }
          ],
          overlay: [
            { method: 'GET', path: '/api/overlay/:overlayId', description: 'Get overlay data by ID' }
          ]
        }
      });
    });

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
        const levelRaw = req.query.level as string | undefined;
        const level: 'info' | 'warn' | 'error' | undefined =
          levelRaw === 'info' || levelRaw === 'warn' || levelRaw === 'error' ? levelRaw : undefined;

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

    // GET /api/export - 导出数据为 CSV
    this.app.get('/api/export', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const options: ExportOptions = {
          room_id: req.query.room_id as string,
          from_ts: req.query.from_ts ? parseInt(req.query.from_ts as string) : undefined,
          to_ts: req.query.to_ts ? parseInt(req.query.to_ts as string) : undefined,
          type: req.query.type as NormalizedEventType,
          filename: req.query.filename as string,
          includeRaw: req.query.includeRaw === 'true'
        };
        const result = await this.csvExporter.exportToCsv(options);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    });

    // GET /api/diagnostics - 获取诊断信息
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
        const levelRaw = req.query.level as string | undefined;
        const level: 'info' | 'warn' | 'error' | undefined =
          levelRaw === 'info' || levelRaw === 'warn' || levelRaw === 'error' ? levelRaw : undefined;

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

    // GET /test-overlay.html - 测试页面
    this.app.get('/test-overlay.html', (req: express.Request, res: express.Response) => {
      const testPagePath = path.join(process.cwd(), 'test-overlay.html');
      if (fs.existsSync(testPagePath)) {
        res.sendFile(testPagePath);
      } else {
        res.status(404).send('Test overlay page not found');
      }
    });

    // GET /api/console/data - 获取控制台页面数据
    this.app.get('/api/console/data', (req: express.Request, res: express.Response) => {
      try {
        const commands = this.consoleManager.getCommands();
        const sessions = this.consoleManager.getActiveSessions();

        res.json({
          success: true,
          data: {
            commands,
            sessions,
            websocket_clients: this.wsHub?.getClientCount() || 0
          }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: (error as Error).message
        });
      }
    });

    // Console API endpoints
    // POST /api/console/sessions - 创建控制台会话
    this.app.post('/api/console/sessions', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const { name } = req.body;
        const session = await this.consoleManager.createSession(name);
        res.json({ success: true, session });
      } catch (error) {
        next(error);
      }
    });

    // DELETE /api/console/sessions/:sessionId - 结束控制台会话
    this.app.delete('/api/console/sessions/:sessionId', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const { sessionId } = req.params;
        const success = await this.consoleManager.endSession(sessionId);
        res.json({ success });
      } catch (error) {
        next(error);
      }
    });

    // POST /api/console/sessions/:sessionId/execute - 执行控制台命令
    this.app.post('/api/console/sessions/:sessionId/execute', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const { sessionId } = req.params;
        const { command } = req.body;
        const result = await this.consoleManager.executeCommand(sessionId, command);
        res.json({ success: true, result });
      } catch (error) {
        next(error);
      }
    });

    // GET /api/console/commands - 获取可用命令列表
    this.app.get('/api/console/commands', (req: express.Request, res: express.Response) => {
      try {
        const commands = this.consoleManager.getCommands();
        res.json({ success: true, commands });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // GET /api/console/sessions - 获取活动会话列表
    this.app.get('/api/console/sessions', (req: express.Request, res: express.Response) => {
      try {
        const sessions = this.consoleManager.getActiveSessions();
        res.json({ success: true, sessions });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // GET /api/console/sessions/:sessionId - 获取特定会话信息
    this.app.get('/api/console/sessions/:sessionId', (req: express.Request, res: express.Response) => {
      try {
        const { sessionId } = req.params;
        const session = this.consoleManager.getSession(sessionId);
        if (session) {
          res.json({ success: true, session });
        } else {
          res.status(404).json({ success: false, error: 'Session not found' });
        }
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // AcFun API 代理路由 - 将所有 /api/acfun/* 请求代理到 AcfunApiProxy
    this.app.use('/api/acfun', this.acfunApiProxy.createRoutes());

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

    // GET /api/overlay/:overlayId - 获取 Overlay 数据
    this.app.get('/api/overlay/:overlayId', (req: express.Request, res: express.Response) => {
      const overlayId = req.params.overlayId;
      const room = req.query.room as string;
      const token = req.query.token as string;

      try {
        // 获取overlay配置
        const overlay = this.overlayManager.getOverlay(overlayId);

        if (!overlay) {
          return res.status(404).json({
            success: false,
            error: 'OVERLAY_NOT_FOUND',
            message: `Overlay with ID '${overlayId}' does not exist or has been removed.`,
            overlayId
          });
        }

        // 返回overlay数据
        res.json({
          success: true,
          data: {
            overlay,
            room,
            token,
            websocket_endpoint: `ws://127.0.0.1:${this.config.port}`
          }
        });

      } catch (error) {
        console.error('[ApiServer] Error getting overlay data:', error);
        res.status(500).json({
          success: false,
          error: 'OVERLAY_ERROR',
          message: 'An error occurred while retrieving overlay data.',
          details: (error as Error).message
        });
      }
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
   * 生成overlay页面HTML
   */
  private generateOverlayPage(overlay: any, room?: string, token?: string): string {
    const { id, type, content, component, props, title, description, position, size, style, className } = overlay;

    // 基础样式
    const baseStyles = `
      * {
        box-sizing: border-box;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: transparent;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
      }
      
      .overlay-container {
        position: fixed;
        ${position?.top !== undefined ? `top: ${position.top}${typeof position.top === 'number' ? 'px' : ''};` : ''}
        ${position?.left !== undefined ? `left: ${position.left}${typeof position.left === 'number' ? 'px' : ''};` : ''}
        ${position?.right !== undefined ? `right: ${position.right}${typeof position.right === 'number' ? 'px' : ''};` : ''}
        ${position?.bottom !== undefined ? `bottom: ${position.bottom}${typeof position.bottom === 'number' ? 'px' : ''};` : ''}
        ${position?.x !== undefined ? `left: ${position.x}${typeof position.x === 'number' ? 'px' : ''};` : ''}
        ${position?.y !== undefined ? `top: ${position.y}${typeof position.y === 'number' ? 'px' : ''};` : ''}
        ${size?.width !== undefined ? `width: ${size.width}${typeof size.width === 'number' ? 'px' : ''};` : ''}
        ${size?.height !== undefined ? `height: ${size.height}${typeof size.height === 'number' ? 'px' : ''};` : ''}
        ${size?.maxWidth !== undefined ? `max-width: ${size.maxWidth}${typeof size.maxWidth === 'number' ? 'px' : ''};` : ''}
        ${size?.maxHeight !== undefined ? `max-height: ${size.maxHeight}${typeof size.maxHeight === 'number' ? 'px' : ''};` : ''}
        ${size?.minWidth !== undefined ? `min-width: ${size.minWidth}${typeof size.minWidth === 'number' ? 'px' : ''};` : ''}
        ${size?.minHeight !== undefined ? `min-height: ${size.minHeight}${typeof size.minHeight === 'number' ? 'px' : ''};` : ''}
        ${style?.backgroundColor ? `background-color: ${style.backgroundColor};` : ''}
        ${style?.opacity !== undefined ? `opacity: ${style.opacity};` : ''}
        ${style?.borderRadius ? `border-radius: ${style.borderRadius};` : ''}
        ${style?.border ? `border: ${style.border};` : ''}
        ${style?.boxShadow ? `box-shadow: ${style.boxShadow};` : ''}
        ${style?.zIndex !== undefined ? `z-index: ${style.zIndex};` : 'z-index: 1000;'}
        pointer-events: auto;
      }
      
      .overlay-content {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      
      .overlay-title {
        font-weight: bold;
        margin-bottom: 8px;
        color: #333;
      }
      
      .overlay-description {
        font-size: 14px;
        color: #666;
        margin-bottom: 12px;
      }
      
      .overlay-text {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      
      .overlay-html {
        width: 100%;
        height: 100%;
      }
      
      .overlay-component {
        width: 100%;
        height: 100%;
      }
    `;

    // 生成内容
    let overlayContent = '';

    switch (type) {
      case 'text':
        overlayContent = `
          <div class="overlay-content">
            ${title ? `<div class="overlay-title">${this.escapeHtml(title)}</div>` : ''}
            ${description ? `<div class="overlay-description">${this.escapeHtml(description)}</div>` : ''}
            <div class="overlay-text">${this.escapeHtml(content || '')}</div>
          </div>
        `;
        break;

      case 'html':
        overlayContent = `
          <div class="overlay-content">
            ${title ? `<div class="overlay-title">${this.escapeHtml(title)}</div>` : ''}
            ${description ? `<div class="overlay-description">${this.escapeHtml(description)}</div>` : ''}
            <div class="overlay-html">${content || ''}</div>
          </div>
        `;
        break;

      case 'component':
        overlayContent = `
          <div class="overlay-content">
            ${title ? `<div class="overlay-title">${this.escapeHtml(title)}</div>` : ''}
            ${description ? `<div class="overlay-description">${this.escapeHtml(description)}</div>` : ''}
            <div class="overlay-component" data-component="${this.escapeHtml(component || '')}" data-props="${this.escapeHtml(JSON.stringify(props || {}))}">
              <div style="padding: 20px; text-align: center; color: #666;">
                Component: ${this.escapeHtml(component || 'Unknown')}
                <br>
                <small>Component rendering requires client-side implementation</small>
              </div>
            </div>
          </div>
        `;
        break;

      default:
        overlayContent = `
          <div class="overlay-content">
            ${title ? `<div class="overlay-title">${this.escapeHtml(title)}</div>` : ''}
            ${description ? `<div class="overlay-description">${this.escapeHtml(description)}</div>` : ''}
            <div style="padding: 20px; text-align: center; color: #666;">
              <div>Overlay ID: ${this.escapeHtml(id)}</div>
              <div>Type: ${this.escapeHtml(type)}</div>
              <div>Status: Active</div>
              ${room ? `<div>Room: ${this.escapeHtml(room)}</div>` : ''}
            </div>
          </div>
        `;
    }

    // 生成完整的HTML页面
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${this.escapeHtml(title || `Overlay ${id}`)}</title>
        <style>${baseStyles}</style>
        <script>
          // Overlay API
          window.overlayApi = {
            id: '${this.escapeHtml(id)}',
            room: '${this.escapeHtml(room || '')}',
            token: '${this.escapeHtml(token || '')}',
            
            // 发送动作到主应用
            action: function(actionId, data) {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: 'overlay-action',
                  overlayId: '${this.escapeHtml(id)}',
                  action: actionId,
                  data: data
                }, '*');
              }
            },
            
            // 关闭overlay
            close: function() {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: 'overlay-close',
                  overlayId: '${this.escapeHtml(id)}'
                }, '*');
              }
            },
            
            // 更新overlay
            update: function(updates) {
              if (window.parent && window.parent !== window) {
                window.parent.postMessage({
                  type: 'overlay-update',
                  overlayId: '${this.escapeHtml(id)}',
                  updates: updates
                }, '*');
              }
            }
          };
          
          // 监听来自主应用的消息
          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'overlay-event' && event.data.overlayId === '${this.escapeHtml(id)}') {
              // 触发自定义事件
              const customEvent = new CustomEvent('overlayEvent', {
                detail: event.data
              });
              window.dispatchEvent(customEvent);
            }
          });
          
          // 页面加载完成后通知主应用
          window.addEventListener('load', function() {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'overlay-loaded',
                overlayId: '${this.escapeHtml(id)}'
              }, '*');
            }
          });
        </script>
      </head>
      <body>
        <div class="overlay-container ${className || ''}" id="overlay-${this.escapeHtml(id)}">
          ${overlayContent}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * HTML转义
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * 生成控制台页面HTML
   */
  private generateConsolePage(): string {
    const commands = this.consoleManager.getCommands();
    const sessions = this.consoleManager.getActiveSessions();

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ACLiveFrame - Console</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .header {
            background: #2d2d30;
            padding: 15px 20px;
            border-bottom: 1px solid #3e3e42;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .header h1 {
            color: #ffffff;
            font-size: 18px;
            font-weight: 600;
          }
          
          .status {
            display: flex;
            gap: 15px;
            font-size: 12px;
          }
          
          .status-item {
            display: flex;
            align-items: center;
            gap: 5px;
          }
          
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #4caf50;
          }
          
          .main-content {
            flex: 1;
            display: flex;
            overflow: hidden;
          }
          
          .sidebar {
            width: 300px;
            background: #252526;
            border-right: 1px solid #3e3e42;
            display: flex;
            flex-direction: column;
          }
          
          .sidebar-section {
            padding: 15px;
            border-bottom: 1px solid #3e3e42;
          }
          
          .sidebar-title {
            font-size: 12px;
            font-weight: 600;
            color: #cccccc;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          
          .command-list {
            max-height: 200px;
            overflow-y: auto;
          }
          
          .command-item {
            padding: 5px 8px;
            margin: 2px 0;
            background: #2d2d30;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .command-item:hover {
            background: #37373d;
          }
          
          .command-name {
            color: #4fc1ff;
            font-weight: 600;
          }
          
          .command-desc {
            color: #9d9d9d;
            margin-top: 2px;
          }
          
          .session-list {
            flex: 1;
            overflow-y: auto;
          }
          
          .session-item {
            padding: 8px 12px;
            margin: 2px 0;
            background: #2d2d30;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .session-item:hover {
            background: #37373d;
          }
          
          .session-item.active {
            background: #0e639c;
          }
          
          .console-area {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #1e1e1e;
          }
          
          .console-output {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
            font-size: 12px;
            line-height: 1.4;
          }
          
          .console-input {
            background: #2d2d30;
            border-top: 1px solid #3e3e42;
            padding: 10px 15px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .prompt {
            color: #4fc1ff;
            font-weight: 600;
          }
          
          .input-field {
            flex: 1;
            background: transparent;
            border: none;
            color: #d4d4d4;
            font-family: inherit;
            font-size: 12px;
            outline: none;
          }
          
          .btn {
            background: #0e639c;
            color: white;
            border: none;
            padding: 5px 12px;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .btn:hover {
            background: #1177bb;
          }
          
          .btn-secondary {
            background: #5a5a5a;
          }
          
          .btn-secondary:hover {
            background: #6a6a6a;
          }
          
          .output-line {
            margin: 2px 0;
          }
          
          .output-command {
            color: #4fc1ff;
          }
          
          .output-result {
            color: #d4d4d4;
            margin-left: 15px;
          }
          
          .output-error {
            color: #f48771;
          }
          
          .output-success {
            color: #4caf50;
          }
          
          .welcome-message {
            color: #9d9d9d;
            text-align: center;
            margin-top: 50px;
          }
          
          .api-info {
            background: #2d2d30;
            border-radius: 5px;
            padding: 10px;
            margin-top: 10px;
            font-size: 11px;
          }
          
          .api-endpoint {
            color: #4fc1ff;
            margin: 2px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>AcFun Live Toolbox Console</h1>
          <div class="status">
            <div class="status-item">
              <div class="status-dot"></div>
              <span>HTTP Server</span>
            </div>
            <div class="status-item">
              <div class="status-dot"></div>
              <span>WebSocket (${this.wsHub?.getClientCount() || 0} clients)</span>
            </div>
            <div class="status-item">
              <div class="status-dot"></div>
              <span>${sessions.length} Sessions</span>
            </div>
          </div>
        </div>
        
        <div class="main-content">
          <div class="sidebar">
            <div class="sidebar-section">
              <div class="sidebar-title">Available Commands</div>
              <div class="command-list">
                ${commands.map(cmd => `
                  <div class="command-item" onclick="insertCommand('${cmd.name}')">
                    <div class="command-name">${cmd.name}</div>
                    <div class="command-desc">${cmd.description}</div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="sidebar-section">
              <div class="sidebar-title">Active Sessions</div>
              <div class="session-list">
                ${sessions.length > 0 ? sessions.map(session => `
                  <div class="session-item" onclick="selectSession('${session.id}')">
                    <div>${session.name || session.id}</div>
                    <div style="color: #9d9d9d; font-size: 10px;">
                      Created: ${new Date(session.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                `).join('') : '<div style="color: #9d9d9d; padding: 10px; text-align: center;">No active sessions</div>'}
              </div>
              
              <div style="padding: 10px; border-top: 1px solid #3e3e42;">
                <button class="btn" onclick="createSession()">New Session</button>
              </div>
            </div>
            
            <div class="sidebar-section">
              <div class="sidebar-title">API Information</div>
              <div class="api-info">
                <div class="api-endpoint">POST /api/console/sessions</div>
                <div class="api-endpoint">GET /api/console/commands</div>
                <div class="api-endpoint">POST /api/console/sessions/:id/execute</div>
                <div style="margin-top: 8px; color: #9d9d9d;">
                  Use these endpoints to integrate with external tools
                </div>
              </div>
            </div>
          </div>
          
          <div class="console-area">
            <div class="console-output" id="output">
              <div class="welcome-message">
                <h3>Welcome to AcFun Live Toolbox Console</h3>
                <p>Create a session or select an existing one to start executing commands.</p>
                <p>Type 'help' to see available commands.</p>
              </div>
            </div>
            
            <div class="console-input">
              <span class="prompt">></span>
              <input type="text" class="input-field" id="commandInput" placeholder="Enter command..." disabled>
              <button class="btn" id="executeBtn" onclick="executeCommand()" disabled>Execute</button>
              <button class="btn btn-secondary" onclick="clearOutput()">Clear</button>
            </div>
          </div>
        </div>
        
        <script>
          let currentSessionId = null;
          
          // 创建新会话
          async function createSession() {
            const name = prompt('Session name (optional):') || 'Console Session';
            try {
              const response = await fetch('/api/console/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
              });
              const data = await response.json();
              if (data.success) {
                currentSessionId = data.session.id;
                updateUI();
                addOutput('System', 'Session created: ' + data.session.id, 'success');
                location.reload(); // 刷新页面以更新会话列表
              }
            } catch (error) {
              addOutput('Error', 'Failed to create session: ' + error.message, 'error');
            }
          }
          
          // 选择会话
          function selectSession(sessionId) {
            currentSessionId = sessionId;
            updateUI();
            addOutput('System', 'Selected session: ' + sessionId, 'success');
          }
          
          // 执行命令
          async function executeCommand() {
            const input = document.getElementById('commandInput');
            const command = input.value.trim();
            if (!command || !currentSessionId) return;
            
            addOutput('Command', command, 'command');
            input.value = '';
            
            try {
              const response = await fetch('/api/console/sessions/' + currentSessionId + '/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
              });
              const data = await response.json();
              if (data.success) {
                const result = data.result;
                addOutput('Result', result.output || 'Command executed successfully', result.success ? 'success' : 'error');
              } else {
                addOutput('Error', data.error || 'Command execution failed', 'error');
              }
            } catch (error) {
              addOutput('Error', 'Network error: ' + error.message, 'error');
            }
          }
          
          // 插入命令到输入框
          function insertCommand(command) {
            const input = document.getElementById('commandInput');
            input.value = command;
            input.focus();
          }
          
          // 添加输出
          function addOutput(type, message, className = '') {
            const output = document.getElementById('output');
            const line = document.createElement('div');
            line.className = 'output-line';
            
            const timestamp = new Date().toLocaleTimeString();
            line.innerHTML = '<span style="color: #9d9d9d;">[' + timestamp + ']</span> ' +
                           '<span class="output-' + className + '">' + type + ':</span> ' +
                           '<span class="output-result">' + message + '</span>';
            
            output.appendChild(line);
            output.scrollTop = output.scrollHeight;
          }
          
          // 清空输出
          function clearOutput() {
            document.getElementById('output').innerHTML = '';
          }
          
          // 更新UI状态
          function updateUI() {
            const input = document.getElementById('commandInput');
            const btn = document.getElementById('executeBtn');
            const hasSession = currentSessionId !== null;
            
            input.disabled = !hasSession;
            btn.disabled = !hasSession;
            
            // 更新会话选择状态
            document.querySelectorAll('.session-item').forEach(item => {
              item.classList.remove('active');
            });
            
            if (hasSession) {
              const activeItem = document.querySelector('[onclick="selectSession(\\'' + currentSessionId + '\\')"]');
              if (activeItem) {
                activeItem.classList.add('active');
              }
            }
          }
          
          // 回车执行命令
          document.getElementById('commandInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              executeCommand();
            }
          });
          
          // 初始化
          updateUI();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * 获取服务器状态
   */
  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }
}
