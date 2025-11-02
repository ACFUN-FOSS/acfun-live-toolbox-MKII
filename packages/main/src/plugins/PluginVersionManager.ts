import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { pluginLogger } from './PluginLogger';
import { PluginManifest } from './PluginManager';

export interface VersionInfo {
  version: string;
  releaseDate: Date;
  changelog: string[];
  downloadUrl?: string;
  checksum?: string;
  isPrerelease: boolean;
  minimumSystemVersion?: string;
}

export interface VersionHistory {
  pluginId: string;
  versions: VersionInfo[];
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
}

export interface VersionConstraint {
  operator: '=' | '>' | '>=' | '<' | '<=' | '~' | '^';
  version: string;
}

export interface PluginVersionInfo {
  version: string;
  installedAt: number;
  size: number;
}

export class PluginVersionManager extends EventEmitter {
  private versionHistory: Map<string, VersionHistory> = new Map();
  private versionCacheDir: string;
  private versionsDir: string;
  private pluginsDir: string;

  constructor(pluginsDir: string) {
    super();
    this.pluginsDir = pluginsDir;
    this.versionsDir = path.join(pluginsDir, '.versions');
    this.versionCacheDir = path.join(pluginsDir, '.version-cache');
    this.ensureCacheDir();
    this.loadVersionHistory();
  }

  /**
   * 确保版本缓存目录存在
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.versionCacheDir)) {
      fs.mkdirSync(this.versionCacheDir, { recursive: true });
    }
    if (!fs.existsSync(this.versionsDir)) {
      fs.mkdirSync(this.versionsDir, { recursive: true });
    }
  }

  /**
   * 加载版本历史记录
   */
  private loadVersionHistory(): void {
    try {
      const historyFile = path.join(this.versionCacheDir, 'history.json');
      if (fs.existsSync(historyFile)) {
        const data = fs.readFileSync(historyFile, 'utf-8');
        const history = JSON.parse(data);
        
        for (const [pluginId, versionHistory] of Object.entries(history)) {
          this.versionHistory.set(pluginId, versionHistory as VersionHistory);
        }
      }
    } catch (error: any) {
      pluginLogger.error('Failed to load version history', undefined, error);
    }
  }

  /**
   * 保存版本历史记录
   */
  private saveVersionHistory(): void {
    try {
      const historyFile = path.join(this.versionCacheDir, 'history.json');
      const history = Object.fromEntries(this.versionHistory);
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    } catch (error: any) {
      pluginLogger.error('Failed to save version history', undefined, error);
    }
  }

  /**
   * 注册插件版本
   */
  public registerPluginVersion(pluginId: string, manifest: PluginManifest): void {
    const versionInfo: VersionInfo = {
      version: manifest.version,
      releaseDate: new Date(),
      changelog: [],
      isPrerelease: this.isPrerelease(manifest.version),
      minimumSystemVersion: manifest.minAppVersion
    };

    let history = this.versionHistory.get(pluginId);
    if (!history) {
      history = {
        pluginId,
        versions: [],
        currentVersion: manifest.version,
        updateAvailable: false
      };
      this.versionHistory.set(pluginId, history);
    }

    // 检查版本是否已存在
    const existingVersion = history.versions.find(v => v.version === manifest.version);
    if (!existingVersion) {
      history.versions.push(versionInfo);
      history.versions.sort((a, b) => this.compareVersions(b.version, a.version));
    }

    history.currentVersion = manifest.version;
    this.saveVersionHistory();

    pluginLogger.info('Plugin version registered', pluginId, {
      pluginId,
      version: manifest.version
    });
  }

  /**
   * 获取插件版本历史
   */
  public getVersionHistory(pluginId: string): VersionHistory | undefined {
    return this.versionHistory.get(pluginId);
  }

  /**
   * 获取所有插件的版本信息
   */
  public getAllVersionHistory(): Map<string, VersionHistory> {
    return new Map(this.versionHistory);
  }

  /**
   * 检查版本更新
   */
  public async checkForUpdates(pluginId: string, registryUrl?: string): Promise<VersionInfo | null> {
    try {
      const history = this.versionHistory.get(pluginId);
      if (!history) {
        return null;
      }

      // 如果提供了注册表URL，从远程检查更新
      if (registryUrl) {
        const remoteVersions = await this.fetchRemoteVersions(pluginId, registryUrl);
        if (remoteVersions && remoteVersions.length > 0) {
          const latestRemote = remoteVersions[0];
          if (this.compareVersions(latestRemote.version, history.currentVersion) > 0) {
            history.latestVersion = latestRemote.version;
            history.updateAvailable = true;
            this.saveVersionHistory();
            
            this.emit('update-available', {
              pluginId,
              currentVersion: history.currentVersion,
              latestVersion: latestRemote.version,
              versionInfo: latestRemote
            });

            return latestRemote;
          }
        }
      }

      return null;
    } catch (error: any) {
      pluginLogger.error('Failed to check for updates', pluginId, error);
      return null;
    }
  }

  /**
   * 从远程获取版本信息
   */
  private async fetchRemoteVersions(pluginId: string, registryUrl: string): Promise<VersionInfo[] | null> {
    try {
      const response = await fetch(`${registryUrl}/plugins/${pluginId}/versions`);
      if (response.ok) {
        const data = await response.json();
        return data.versions || [];
      }
    } catch (error: any) {
      pluginLogger.error('Failed to fetch remote versions', pluginId, error);
    }
    return null;
  }

  /**
   * 比较版本号
   */
  public compareVersions(version1: string, version2: string): number {
    try {
      const v1Parts = this.parseVersion(version1);
      const v2Parts = this.parseVersion(version2);

      for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const v1Part = v1Parts[i] || 0;
        const v2Part = v2Parts[i] || 0;

        if (v1Part > v2Part) return 1;
        if (v1Part < v2Part) return -1;
      }

      return 0;
    } catch (error: any) {
      pluginLogger.error('Version comparison failed:', undefined, error);
      return 0;
    }
  }

  /**
   * 解析版本号
   */
  private parseVersion(version: string): number[] {
    return version.replace(/[^\d.]/g, '').split('.').map(Number);
  }

  /**
   * 检查是否为预发布版本
   */
  private isPrerelease(version: string): boolean {
    return /-(alpha|beta|rc|pre)/i.test(version);
  }

  /**
   * 检查版本约束
   */
  public satisfiesConstraint(version: string, constraint: string): boolean {
    try {
      const parsed = this.parseConstraint(constraint);
      if (!parsed) return true;

      const comparison = this.compareVersions(version, parsed.version);

      switch (parsed.operator) {
        case '=':
          return comparison === 0;
        case '>':
          return comparison > 0;
        case '>=':
          return comparison >= 0;
        case '<':
          return comparison < 0;
        case '<=':
          return comparison <= 0;
        case '~':
          return this.satisfiesTildeRange(version, parsed.version);
        case '^':
          return this.satisfiesCaretRange(version, parsed.version);
        default:
          return true;
      }
    } catch (error: any) {
      pluginLogger.error('Version constraint check failed:', undefined, error);
      return false;
    }
  }

  /**
   * 解析版本约束
   */
  private parseConstraint(constraint: string): VersionConstraint | null {
    const match = constraint.match(/^([=><~^]+)(.+)$/);
    if (!match) {
      return { operator: '=', version: constraint };
    }

    return {
      operator: match[1] as VersionConstraint['operator'],
      version: match[2]
    };
  }

  /**
   * 检查波浪号范围 (~1.2.3 允许 >=1.2.3 <1.3.0)
   */
  private satisfiesTildeRange(version: string, constraint: string): boolean {
    const vParts = this.parseVersion(version);
    const cParts = this.parseVersion(constraint);

    if (vParts[0] !== cParts[0] || vParts[1] !== cParts[1]) {
      return false;
    }

    return vParts[2] >= (cParts[2] || 0);
  }

  /**
   * 检查插入符号范围 (^1.2.3 允许 >=1.2.3 <2.0.0)
   */
  private satisfiesCaretRange(version: string, constraint: string): boolean {
    const vParts = this.parseVersion(version);
    const cParts = this.parseVersion(constraint);

    if (vParts[0] !== cParts[0]) {
      return false;
    }

    return this.compareVersions(version, constraint) >= 0;
  }

  /**
   * 获取版本变更日志
   */
  public getChangelog(pluginId: string, fromVersion?: string, toVersion?: string): string[] {
    const history = this.versionHistory.get(pluginId);
    if (!history) return [];

    let versions = history.versions;

    if (fromVersion || toVersion) {
      versions = versions.filter(v => {
        if (fromVersion && this.compareVersions(v.version, fromVersion) <= 0) {
          return false;
        }
        if (toVersion && this.compareVersions(v.version, toVersion) > 0) {
          return false;
        }
        return true;
      });
    }

    return versions.flatMap(v => v.changelog);
  }

  /**
   * 回滚到指定版本
   */
  public async rollbackToVersion(pluginId: string, targetVersion: string): Promise<boolean> {
    try {
      const currentVersionDir = path.join(this.pluginsDir, pluginId);
      const backupVersionDir = path.join(this.versionsDir, pluginId, targetVersion);
      
      if (!fs.existsSync(backupVersionDir)) {
        throw new Error(`Backup version ${targetVersion} not found for plugin ${pluginId}`);
      }
  
      // 备份当前版本
      const currentBackupDir = path.join(this.versionsDir, pluginId, `current_${Date.now()}`);
      fs.cpSync(currentVersionDir, currentBackupDir, { recursive: true });
  
      // 删除当前版本
      fs.rmSync(currentVersionDir, { recursive: true, force: true });
  
      // 恢复目标版本
      fs.cpSync(backupVersionDir, currentVersionDir, { recursive: true });
  
      pluginLogger.info(`Plugin ${pluginId} rolled back to version ${targetVersion}`, pluginId);
      return true;
    } catch (error: any) {
      pluginLogger.error(`Failed to rollback plugin ${pluginId} to version ${targetVersion}:`, pluginId, error);
      return false;
    }
  }

  /**
   * 清理旧版本数据
   */
  public async cleanupOldVersions(pluginId: string, keepCount: number = 5): Promise<void> {
    try {
      const versionDir = path.join(this.versionsDir, pluginId);
      if (!fs.existsSync(versionDir)) {
        return;
      }

      const versions = fs.readdirSync(versionDir)
        .filter(file => fs.statSync(path.join(versionDir, file)).isDirectory())
        .sort((a, b) => this.compareVersions(b, a)); // 降序排列

      // 只保留最新的keepCount个版本
      if (versions.length > keepCount) {
        const versionsToRemove = versions.slice(keepCount);
        
        for (const version of versionsToRemove) {
          const versionPath = path.join(versionDir, version);
          fs.rmSync(versionPath, { recursive: true, force: true });
          pluginLogger.info(`Removed old version ${version} for plugin ${pluginId}`, pluginId);
        }
      }
    } catch (error: any) {
      pluginLogger.error(`Failed to cleanup old versions for plugin ${pluginId}:`, pluginId, error);
    }
  }

  /**
   * 清理所有数据
   */
  public cleanup(): void {
    this.versionHistory.clear();
    this.removeAllListeners();
  }

  private getDirectorySize(dirPath: string): number {
    try {
      let size = 0;
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          size += this.getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      }
      
      return size;
    } catch (error: any) {
      pluginLogger.error(`Failed to calculate directory size for ${dirPath}:`, undefined, error);
      return 0;
    }
  }
}

// 导出单例实例
export const pluginVersionManager = new PluginVersionManager(
  path.join(process.cwd(), 'plugins')
);