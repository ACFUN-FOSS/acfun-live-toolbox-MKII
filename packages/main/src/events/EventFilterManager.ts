import { EventEmitter } from 'events';
import { ConfigManager } from '../config/ConfigManager';
import { EventFilter, DEFAULT_FILTERS, validateEvent, applyFilters, getEventQualityScore } from './normalize';
import type { NormalizedEvent } from '../types';

export interface FilterConfig {
  enabled: boolean;
  name: string;
  description: string;
  settings?: Record<string, any>;
}

export interface EventFilterSettings {
  enabledFilters: string[];
  minQualityScore: number;
  customRules: FilterConfig[];
  rateLimits: {
    globalLimit: number;
    userLimit: number;
    windowMs: number;
  };
  spamDetection: {
    enabled: boolean;
    maxRepeatedChars: number;
    maxEmojiCount: number;
    duplicateWindowMs: number;
  };
}

export class EventFilterManager extends EventEmitter {
  private configManager: ConfigManager;
  private settings: EventFilterSettings;
  private customFilters: Map<string, EventFilter> = new Map();
  private stats = {
    totalProcessed: 0,
    totalFiltered: 0,
    filterStats: new Map<string, number>()
  };

  constructor(configManager: ConfigManager) {
    super();
    this.configManager = configManager;
    this.settings = this.loadSettings();
    this.initializeCustomFilters();
  }

  private loadSettings(): EventFilterSettings {
    return this.configManager.get('eventFilter', {
      enabledFilters: ['spam_filter', 'duplicate_filter'],
      minQualityScore: 60,
      customRules: [],
      rateLimits: {
        globalLimit: 1000,
        userLimit: 30,
        windowMs: 60000
      },
      spamDetection: {
        enabled: true,
        maxRepeatedChars: 10,
        maxEmojiCount: 10,
        duplicateWindowMs: 5000
      }
    });
  }

  private saveSettings(): void {
    this.configManager.set('eventFilter', this.settings);
  }

  private initializeCustomFilters(): void {
    // 初始化自定义过滤器
    for (const rule of this.settings.customRules) {
      if (rule.enabled) {
        this.createCustomFilter(rule);
      }
    }
  }

  private createCustomFilter(config: FilterConfig): void {
    // 这里可以根据配置创建自定义过滤器
    // 简化实现，实际可以支持更复杂的规则配置
    const filter: EventFilter = {
      name: config.name,
      description: config.description,
      filter: (event: NormalizedEvent) => {
        // 基于配置的简单过滤逻辑
        if (config.settings?.blockedWords) {
          const blockedWords = config.settings.blockedWords as string[];
          if (event.content && blockedWords.some(word => 
            event.content!.toLowerCase().includes(word.toLowerCase())
          )) {
            return false;
          }
        }
        
        if (config.settings?.allowedUsers) {
          const allowedUsers = config.settings.allowedUsers as string[];
          if (event.user_id && !allowedUsers.includes(event.user_id)) {
            return false;
          }
        }
        
        return true;
      }
    };
    
    this.customFilters.set(config.name, filter);
  }

  /**
   * 处理事件并应用过滤器
   */
  public processEvent(event: NormalizedEvent): { passed: boolean; reason?: string; qualityScore: number } {
    this.stats.totalProcessed++;
    
    // 获取质量分数
    const qualityScore = getEventQualityScore(event);
    
    // 检查最低质量分数
    if (qualityScore < this.settings.minQualityScore) {
      this.stats.totalFiltered++;
      this.updateFilterStats('quality_score');
      return { passed: false, reason: 'Quality score too low', qualityScore };
    }
    
    // 应用启用的默认过滤器
    const enabledDefaultFilters = DEFAULT_FILTERS.filter(f => 
      this.settings.enabledFilters.includes(f.name)
    );
    
    const defaultFilterResult = applyFilters(event, enabledDefaultFilters);
    if (!defaultFilterResult.passed) {
      this.stats.totalFiltered++;
      defaultFilterResult.failedFilters.forEach(filter => this.updateFilterStats(filter));
      return { 
        passed: false, 
        reason: `Filtered by: ${defaultFilterResult.failedFilters.join(', ')}`, 
        qualityScore 
      };
    }
    
    // 应用自定义过滤器
    const enabledCustomFilters = Array.from(this.customFilters.values()).filter(f =>
      this.settings.enabledFilters.includes(f.name)
    );
    
    const customFilterResult = applyFilters(event, enabledCustomFilters);
    if (!customFilterResult.passed) {
      this.stats.totalFiltered++;
      customFilterResult.failedFilters.forEach(filter => this.updateFilterStats(filter));
      return { 
        passed: false, 
        reason: `Filtered by custom rules: ${customFilterResult.failedFilters.join(', ')}`, 
        qualityScore 
      };
    }
    
    return { passed: true, qualityScore };
  }

  private updateFilterStats(filterName: string): void {
    const current = this.stats.filterStats.get(filterName) || 0;
    this.stats.filterStats.set(filterName, current + 1);
  }

  /**
   * 获取过滤统计信息
   */
  public getStats() {
    return {
      ...this.stats,
      filterStats: Object.fromEntries(this.stats.filterStats),
      filterRate: this.stats.totalProcessed > 0 ? 
        (this.stats.totalFiltered / this.stats.totalProcessed * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.stats.totalProcessed = 0;
    this.stats.totalFiltered = 0;
    this.stats.filterStats.clear();
  }

  /**
   * 获取当前设置
   */
  public getSettings(): EventFilterSettings {
    return { ...this.settings };
  }

  /**
   * 更新设置
   */
  public updateSettings(newSettings: Partial<EventFilterSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    
    // 重新初始化自定义过滤器
    this.customFilters.clear();
    this.initializeCustomFilters();
    
    this.emit('settingsUpdated', this.settings);
  }

  /**
   * 获取可用的过滤器列表
   */
  public getAvailableFilters(): Array<{ name: string; description: string; type: 'default' | 'custom' }> {
    const filters = [
      ...DEFAULT_FILTERS.map(f => ({ name: f.name, description: f.description, type: 'default' as const })),
      ...Array.from(this.customFilters.values()).map(f => ({ name: f.name, description: f.description, type: 'custom' as const }))
    ];
    
    return filters;
  }

  /**
   * 添加自定义过滤规则
   */
  public addCustomRule(config: FilterConfig): void {
    this.settings.customRules.push(config);
    if (config.enabled) {
      this.createCustomFilter(config);
      // 将自定义过滤器添加到启用的过滤器列表中
      if (!this.settings.enabledFilters.includes(config.name)) {
        this.settings.enabledFilters.push(config.name);
      }
    }
    this.saveSettings();
    this.emit('customRuleAdded', config);
  }

  /**
   * 移除自定义过滤规则
   */
  public removeCustomRule(name: string): void {
    this.settings.customRules = this.settings.customRules.filter(rule => rule.name !== name);
    this.customFilters.delete(name);
    // 从启用的过滤器列表中移除
    this.settings.enabledFilters = this.settings.enabledFilters.filter(filterName => filterName !== name);
    this.saveSettings();
    this.emit('customRuleRemoved', name);
  }

  /**
   * 测试事件是否会被过滤（不影响统计信息）
   */
  public testEvent(event: NormalizedEvent): {
    passed: boolean;
    qualityScore: number;
    failedFilters: string[];
    validationErrors: string[];
  } {
    const validation = validateEvent(event);
    
    // 获取质量分数
    const qualityScore = getEventQualityScore(event);
    
    // 检查最低质量分数
    if (qualityScore < this.settings.minQualityScore) {
      return { 
        passed: false, 
        qualityScore, 
        failedFilters: ['quality_score'], 
        validationErrors: validation.errors 
      };
    }
    
    // 应用启用的默认过滤器
    const enabledDefaultFilters = DEFAULT_FILTERS.filter(f => 
      this.settings.enabledFilters.includes(f.name)
    );
    
    const defaultFilterResult = applyFilters(event, enabledDefaultFilters);
    if (!defaultFilterResult.passed) {
      return { 
        passed: false, 
        qualityScore,
        failedFilters: defaultFilterResult.failedFilters, 
        validationErrors: validation.errors 
      };
    }
    
    // 应用自定义过滤器
    const enabledCustomFilters = Array.from(this.customFilters.values()).filter(f =>
      this.settings.enabledFilters.includes(f.name)
    );
    
    const customFilterResult = applyFilters(event, enabledCustomFilters);
    if (!customFilterResult.passed) {
      return { 
        passed: false, 
        qualityScore,
        failedFilters: customFilterResult.failedFilters, 
        validationErrors: validation.errors 
      };
    }
    
    return { 
      passed: true, 
      qualityScore, 
      failedFilters: [], 
      validationErrors: validation.errors 
    };
  }
}