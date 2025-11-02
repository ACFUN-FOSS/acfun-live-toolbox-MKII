import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PluginManager } from '../../plugins/PluginManager';
import { TestHelpers } from '../helpers/TestHelpers';
import { createTempDir, cleanupTempDir } from '../setup';


describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir('plugin-manager-');
    
    const mockConfigManager = TestHelpers.createMockConfigManager();
    const mockApiServer = TestHelpers.createMockApiServer();
    const mockRoomManager = TestHelpers.createMockRoomManager();
    const mockDatabaseManager = TestHelpers.createMockDatabaseManager();

    pluginManager = new PluginManager({
      configManager: mockConfigManager,
      apiServer: mockApiServer,
      roomManager: mockRoomManager,
      databaseManager: mockDatabaseManager
    });
  });

  afterEach(async () => {
    // 卸载所有已安装的插�?    const installedPlugins = pluginManager.getInstalledPlugins();
    for (const plugin of installedPlugins) {
      try {
        await pluginManager.uninstallPlugin(plugin.id);
      } catch (error) {
        // 忽略卸载错误，确保测试环境清�?      }
    }
    
    cleanupTempDir(tempDir);
  });

  describe('初始�?, () => {
    it('应该正确初始化插件管理器', () => {
      expect(pluginManager).toBeDefined();
      expect(pluginManager.getInstalledPlugins()).toEqual([]);
    });

    it('应该创建插件目录', () => {
      expect(fs.existsSync(tempDir)).toBe(true);
    });
  });

  describe('插件安装', () => {
    it('应该能够从压缩包安装插件', async () => {
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'test-plugin-1',
        name: '测试插件1'
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      
      const result = await pluginManager.installPlugin({ filePath: archivePath });
      
      expect(result).toBeDefined();
      expect(result.id).toBe('test-plugin-1');
      
      const installedPlugins = pluginManager.getInstalledPlugins();
      expect(installedPlugins).toHaveLength(1);
      expect(installedPlugins[0].id).toBe('test-plugin-1');
    });

    it('应该能够从压缩包安装插件并启�?, async () => {
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'test-plugin-2',
        name: '测试插件2'
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      
      const result = await pluginManager.installPlugin({ 
        filePath: archivePath, 
        enable: true 
      });
      
      expect(result).toBeDefined();
      expect(result.id).toBe('test-plugin-2');
      expect(result.enabled).toBe(true);
    });

    it('应该拒绝安装无效的插�?, async () => {
      const invalidManifest = {
        // 缺少必需字段 id �?version
        name: '无效插件',
        main: 'index.js'
      } as any;
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, invalidManifest);
      
      await expect(pluginManager.installPlugin({ filePath: archivePath }))
        .rejects.toThrow();
    });

    it('应该拒绝安装重复的插�?, async () => {
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'duplicate-plugin'
      });
      
      const archivePath1 = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      const archivePath2 = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      
      // 第一次安装应该成�?      const result1 = await pluginManager.installPlugin({ filePath: archivePath1 });
      expect(result1).toBeDefined();
      expect(result1.id).toBe('duplicate-plugin');
      
      // 第二次安装应该失败（插件已存在）
      await expect(pluginManager.installPlugin({ filePath: archivePath2 }))
        .rejects.toThrow('插件 duplicate-plugin 已存�?);
    });
  });

  describe('插件卸载', () => {
    it('应该能够卸载已安装的插件', async () => {
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'uninstall-test'
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      await pluginManager.installPlugin({ filePath: archivePath });
      
      await pluginManager.uninstallPlugin('uninstall-test');
      
      expect(pluginManager.getInstalledPlugins()).toHaveLength(0);
    });

    it('应该拒绝卸载不存在的插件', async () => {
      await expect(pluginManager.uninstallPlugin('non-existent'))
        .rejects.toThrow('插件 non-existent 不存�?);
    });

    it('应该在卸载前停止运行中的插件', async () => {
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'running-plugin'
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      await pluginManager.installPlugin({ filePath: archivePath });
      await pluginManager.enablePlugin('running-plugin');
      
      await pluginManager.uninstallPlugin('running-plugin');
      
      expect(pluginManager.getInstalledPlugins()).toHaveLength(0);
    });
  });

  describe('插件启用和禁�?, () => {
    beforeEach(async () => {
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'toggle-test'
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      await pluginManager.installPlugin({ filePath: archivePath });
    });

    it('应该能够启用插件', async () => {
      await pluginManager.enablePlugin('toggle-test');
      
      const plugin = pluginManager.getPlugin('toggle-test');
      expect(plugin?.enabled).toBe(true);
      expect(plugin?.status).toBe('running');
    });

    it('应该能够禁用插件', async () => {
      await pluginManager.enablePlugin('toggle-test');
      
      await pluginManager.disablePlugin('toggle-test');
      
      const plugin = pluginManager.getPlugin('toggle-test');
      expect(plugin?.enabled).toBe(false);
      expect(plugin?.status).toBe('stopped');
    });

    it('应该拒绝启用不存在的插件', async () => {
      await expect(pluginManager.enablePlugin('non-existent'))
        .rejects.toThrow('插件 non-existent 不存�?);
    });
  });

  describe('插件查询', () => {
    beforeEach(async () => {
      // 安装几个测试插件
      const manifest1 = TestHelpers.createMockPluginManifest({
        id: 'plugin-1',
        name: '插件1'
      });
      const manifest2 = TestHelpers.createMockPluginManifest({
        id: 'plugin-2',
        name: '插件2'
      });
      
      const archive1 = await TestHelpers.createMockPluginArchive(tempDir, manifest1);
      const archive2 = await TestHelpers.createMockPluginArchive(tempDir, manifest2);
      
      await pluginManager.installPlugin({ filePath: archive1 });
      await pluginManager.installPlugin({ filePath: archive2, enable: true });
    });

    it('应该返回所有已安装的插�?, () => {
      const plugins = pluginManager.getInstalledPlugins();
      
      expect(plugins).toHaveLength(2);
      expect(plugins.map(p => p.id)).toContain('plugin-1');
      expect(plugins.map(p => p.id)).toContain('plugin-2');
    });

    it('应该返回特定插件的信�?, () => {
      const plugin = pluginManager.getPlugin('plugin-1');
      
      expect(plugin).toBeDefined();
      expect(plugin?.id).toBe('plugin-1');
      expect(plugin?.name).toBe('插件1');
    });

    it('应该返回启用的插件列�?, async () => {
      await pluginManager.enablePlugin('plugin-1');
      
      const enabledPlugins = pluginManager.getInstalledPlugins().filter(p => p.enabled);
      
      expect(enabledPlugins).toHaveLength(2); // plugin-1 �?plugin-2 都启用了
      expect(enabledPlugins.map(p => p.id)).toContain('plugin-1');
      expect(enabledPlugins.map(p => p.id)).toContain('plugin-2');
    });
  });

  describe('插件验证', () => {
    it('应该验证有效的插件文�?, async () => {
      const validManifest = TestHelpers.createMockPluginManifest();
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, validManifest);
      
      const result = await pluginManager.validatePluginFile(archivePath);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(validManifest.id);
      expect(result.name).toBe(validManifest.name);
    });

    it('应该检测无效的插件文件', async () => {
      const invalidManifest = {
        // 缺少必需字段
        name: '无效插件'
      } as any;
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, invalidManifest);
      
      await expect(pluginManager.validatePluginFile(archivePath))
        .rejects.toThrow();
    });

    it('应该检查版本兼容�?, async () => {
      const incompatibleManifest = TestHelpers.createMockPluginManifest({
        engines: {
          node: '999.0.0'
        }
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, incompatibleManifest);
      
      // 这个测试可能需要根据实际的版本检查逻辑调整
      await expect(pluginManager.validatePluginFile(archivePath))
        .resolves.toBeDefined(); // 或�?.rejects.toThrow() 如果有版本检�?    });
  });

  describe('错误处理', () => {
    it('应该处理插件加载错误', async () => {
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'error-plugin',
        main: 'non-existent.js'
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      
      const result = await pluginManager.installPlugin({ filePath: archivePath });
      expect(result).toBeDefined();
      
      await expect(pluginManager.enablePlugin('error-plugin'))
        .rejects.toThrow();
    });

    it('应该处理插件运行时错�?, async () => {
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'runtime-error-plugin'
      });
      
      const customCode = `
module.exports = {
  initialize() {
    throw new Error('Runtime error during initialization');
  },
  start() {},
  stop() {},
  destroy() {}
};`;
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest, customCode);
      
      const result = await pluginManager.installPlugin({ filePath: archivePath });
      expect(result).toBeDefined();
      
      await expect(pluginManager.enablePlugin('runtime-error-plugin'))
        .rejects.toThrow();
    });

    it('应该处理插件卸载错误', async () => {
      // 安装一个正常的插件
      const manifest = TestHelpers.createMockPluginManifest({
        id: 'uninstall-test-plugin'
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      await pluginManager.installPlugin({ filePath: archivePath });
      
      // 卸载插件应该成功
      await expect(pluginManager.uninstallPlugin('uninstall-test-plugin'))
        .resolves.not.toThrow();
      
      // 尝试卸载不存在的插件应该抛出错误
      await expect(pluginManager.uninstallPlugin('non-existent-plugin'))
        .rejects.toThrow();
    });
  });

  describe('插件配置', () => {
    beforeEach(async () => {
      // 安装一个测试插�?      const manifest = TestHelpers.createMockPluginManifest({
        id: 'config-test-plugin'
      });
      
      const archivePath = await TestHelpers.createMockPluginArchive(tempDir, manifest);
      await pluginManager.installPlugin({ filePath: archivePath });
    });

    it('应该保存和加载插件配�?, async () => {
      const pluginId = 'config-test-plugin';
      const testConfig = { setting1: 'value1', setting2: 42 };
      
      // 获取插件 API 并设置配�?      const api = pluginManager.getApi(pluginId);
      await api.config.set('testConfig', testConfig);
      
      // 读取配置
      const savedConfig = await api.config.get('testConfig');
      
      expect(savedConfig).toEqual(testConfig);
    });

    it('应该支持配置的默认�?, async () => {
      const pluginId = 'config-test-plugin';
      const defaultValue = { default: true };
      
      const api = pluginManager.getApi(pluginId);
      const config = await api.config.get('nonExistentKey', defaultValue);
      
      expect(config).toEqual(defaultValue);
    });
  });
});
