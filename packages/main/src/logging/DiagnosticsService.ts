import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { getLogManager } from './LogManager';
import { DatabaseManager } from '../persistence/DatabaseManager';
import { ConfigManager } from '../config/ConfigManager';
import archiver from 'archiver';

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  appVersion: string;
  totalMemory: number;
  freeMemory: number;
  cpuCount: number;
  uptime: number;
  userDataPath: string;
  timestamp: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  status: string;
  // 不包含敏感配置信息
}

export interface DiagnosticPackage {
  systemInfo: SystemInfo;
  plugins: PluginInfo[];
  recentLogs: any[];
  databaseSchema: any[];
  configSample: any;
  packageInfo: any;
}

export class DiagnosticsService {
  private readonly logManager = getLogManager();
  private readonly outputDir: string;

  constructor(
    private readonly databaseManager: DatabaseManager,
    private readonly configManager: ConfigManager
  ) {
    this.outputDir = path.join(app.getPath('userData'), 'diagnostics');
    this.ensureOutputDirectory();
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private collectSystemInfo(): SystemInfo {
    const packageJson = this.getPackageInfo();
    
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      electronVersion: process.versions.electron || 'unknown',
      appVersion: packageJson?.version || 'unknown',
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      uptime: os.uptime(),
      userDataPath: app.getPath('userData'),
      timestamp: new Date().toISOString()
    };
  }

  private getPackageInfo(): any {
    try {
      const packagePath = path.join(__dirname, '../../package.json');
      if (fs.existsSync(packagePath)) {
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      }
    } catch (error: any) {
      this.logManager.addLog('diagnostics', `Failed to read package.json: ${error}`, 'warn');
    }
    return null;
  }

  private collectPluginInfo(): PluginInfo[] {
    // TODO: 当PluginManager实现后，从那里获取插件信息
    // 现在返回空数组作为占位符
    try {
      const pluginsDir = path.join(app.getPath('userData'), 'plugins');
      if (!fs.existsSync(pluginsDir)) {
        return [];
      }

      const plugins: PluginInfo[] = [];
      const pluginDirs = fs.readdirSync(pluginsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const pluginId of pluginDirs) {
        try {
          const manifestPath = path.join(pluginsDir, pluginId, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            plugins.push({
              id: pluginId,
              name: manifest.name || pluginId,
              version: manifest.version || 'unknown',
              enabled: manifest.enabled !== false,
              status: 'unknown' // TODO: 从PluginManager获取实际状态
            });
          }
        } catch (error: any) {
          this.logManager.addLog('diagnostics', `Failed to read plugin manifest for ${pluginId}: ${error}`, 'warn');
        }
      }

      return plugins;
    } catch (error: any) {
      this.logManager.addLog('diagnostics', `Failed to collect plugin info: ${error}`, 'error');
      return [];
    }
  }

  private async collectDatabaseSchema(): Promise<any[]> {
    try {
      const db = this.databaseManager.getDb();
      const result = await new Promise<any[]>((resolve, reject) => {
        db.all(`
          SELECT name, type, sql 
          FROM sqlite_master 
          WHERE type IN ('table', 'index', 'view')
          ORDER BY type, name
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      // 只返回结构信息，不包含实际数据
      return result.map(row => ({
        name: row.name,
        type: row.type,
        sql: row.sql
      }));
    } catch (error: any) {
      this.logManager.addLog('diagnostics', `Failed to collect database schema: ${error}`, 'error');
      return [];
    }
  }

  private sanitizeConfig(config: any): any {
    if (!config) return {};

    const sanitized = JSON.parse(JSON.stringify(config));
    
    // 递归移除敏感字段
    const removeSensitiveFields = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(removeSensitiveFields);
      }

      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('token') || 
            lowerKey.includes('secret') || 
            lowerKey.includes('password') || 
            lowerKey.includes('auth') ||
            lowerKey.includes('cookie')) {
          result[key] = '***REDACTED***';
        } else {
          result[key] = removeSensitiveFields(value);
        }
      }
      return result;
    };

    return removeSensitiveFields(sanitized);
  }

  /**
   * 获取最近的日志条目
   */
  public getRecentLogs(limit: number = 100, level?: 'info' | 'error' | 'warn' | 'debug'): any[] {
    const logs = this.logManager.getRecentLogs(limit);
    return level ? logs.filter((l: any) => l.level === level) : logs;
  }

  /**
   * 生成诊断包
   */
  async generateDiagnosticPackage(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const packageFileName = `diagnostic-package-${timestamp}.zip`;
    const packagePath = path.join(this.outputDir, packageFileName);

    try {
      this.logManager.addLog('diagnostics', 'Starting diagnostic package generation', 'info');

      // 收集诊断信息
      const diagnosticData: DiagnosticPackage = {
        systemInfo: this.collectSystemInfo(),
        plugins: this.collectPluginInfo(),
        recentLogs: this.logManager.getRecentLogs(500), // 最近500条日志
        databaseSchema: await this.collectDatabaseSchema(),
        configSample: this.sanitizeConfig(this.configManager.getAll()),
        packageInfo: this.getPackageInfo()
      };

      // 创建ZIP文件
      const output = fs.createWriteStream(packagePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          this.logManager.addLog('diagnostics', `Diagnostic package created: ${packagePath} (${archive.pointer()} bytes)`, 'info');
          resolve(packagePath);
        });

        archive.on('error', (err: any) => {
          this.logManager.addLog('diagnostics', `Failed to create diagnostic package: ${err.message}`, 'error');
          reject(err);
        });

        archive.pipe(output);

        // 添加诊断数据JSON文件
        archive.append(JSON.stringify(diagnosticData, null, 2), { name: 'diagnostic-data.json' });

        // 添加日志文件
        const logFiles = this.logManager.getLogFiles();
        logFiles.forEach((logFile, index) => {
          if (fs.existsSync(logFile)) {
            const fileName = path.basename(logFile);
            archive.file(logFile, { name: `logs/${fileName}` });
          }
        });

        // 添加系统信息文件
        archive.append(JSON.stringify(diagnosticData.systemInfo, null, 2), { name: 'system-info.json' });

        // 添加插件信息文件
        archive.append(JSON.stringify(diagnosticData.plugins, null, 2), { name: 'plugins.json' });

        // 添加数据库架构文件
        archive.append(JSON.stringify(diagnosticData.databaseSchema, null, 2), { name: 'database-schema.json' });

        // 添加配置文件（脱敏后）
        archive.append(JSON.stringify(diagnosticData.configSample, null, 2), { name: 'config-sanitized.json' });

        archive.finalize();
      });

    } catch (error: any) {
      this.logManager.addLog('diagnostics', `Failed to generate diagnostic package: ${error}`, 'error');
      throw error;
    }
  }

  async cleanupOldPackages(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = fs.readdirSync(this.outputDir);
      const now = Date.now();

      for (const file of files) {
        if (file.startsWith('diagnostic-package-') && file.endsWith('.zip')) {
          const filePath = path.join(this.outputDir, file);
          const stats = fs.statSync(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            this.logManager.addLog('diagnostics', `Cleaned up old diagnostic package: ${file}`, 'info');
          }
        }
      }
    } catch (error: any) {
      this.logManager.addLog('diagnostics', `Failed to cleanup old packages: ${error}`, 'warn');
    }
  }
}