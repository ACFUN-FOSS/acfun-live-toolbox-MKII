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
  private pluginRoutes: Map<string, { method: 'GET' | 'POST'; path: string; handler: express.RequestHandler }[]> = new Map();

  constructor(config: ApiServerConfig = { port: 1299 }, databaseManager: DatabaseManager, diagnosticsService: DiagnosticsService, overlayManager: OverlayManager) {
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
      
      try {
        // 获取overlay配置
        const overlay = this.overlayManager.getOverlay(overlayId);
        
        if (!overlay) {
          return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Overlay Not Found</title>
              <meta charset="utf-8">
              <style>
                body { 
                  margin: 0; 
                  padding: 20px; 
                  font-family: Arial, sans-serif;
                  background: transparent;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                }
                .error-info {
                  background: rgba(255,0,0,0.8);
                  color: white;
                  padding: 20px;
                  border-radius: 8px;
                  text-align: center;
                }
              </style>
            </head>
            <body>
              <div class="error-info">
                <h3>Overlay Not Found</h3>
                <p>Overlay ID: ${overlayId}</p>
                <p>The requested overlay does not exist or has been removed.</p>
              </div>
            </body>
            </html>
          `);
        }

        // 生成overlay页面
        const overlayHtml = this.generateOverlayPage(overlay, room, token);
        res.send(overlayHtml);
        
      } catch (error) {
        console.error('[ApiServer] Error generating overlay page:', error);
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Overlay Error</title>
            <meta charset="utf-8">
            <style>
              body { 
                margin: 0; 
                padding: 20px; 
                font-family: Arial, sans-serif;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .error-info {
                background: rgba(255,165,0,0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="error-info">
              <h3>Overlay Error</h3>
              <p>An error occurred while generating the overlay page.</p>
              <p>Please try again later.</p>
            </div>
          </body>
          </html>
        `);
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
   * 获取服务器状态
   */
  public isRunning(): boolean {
    return this.server !== null && this.server.listening;
  }
}
