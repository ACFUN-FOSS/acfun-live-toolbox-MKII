//本程序用于小程序之间以及小程序与主程序之间的数据协同

import { EventEmitter } from 'events';
import { AppManager } from './AppManager';

/**
 * 黑板数据项接口定义
 * 包含数据值、时间戳和发布者信息
 */
interface BlackboardDataItem<T = any> {
  value: T;
  timestamp: number;
  publisher: string; // 发布者ID，格式为`app:{appId}`或`main`表示主程序
}

/**
 * 订阅者信息接口
 */
interface Subscriber {
  id: string; // 订阅者ID，格式为`app:{appId}`或`main`
  type: "main" | "obs" | "client"; // 订阅者类型
  callback: (data: BlackboardDataItem) => void;
}

/**
 * 黑板(Blackboard)设计模式实现的消息中心
 * 用于小程序之间以及小程序与主程序之间的数据协同
 */
export class DataManager extends EventEmitter {
  private static instance: DataManager;
  private blackboard: Map<string, BlackboardDataItem>; // 黑板数据存储，key为主题
  private subscribers: Map<string, Subscriber[]>; // 订阅者列表，key为主题
  private appManager: AppManager | undefined;
  private testMessageInterval?: NodeJS.Timeout;

  private constructor() {
    super();
    this.blackboard = new Map();
    this.subscribers = new Map();
    // 移除构造函数中的appManager初始化
    // this.appManager = globalThis.appManager;
    // this.setupCleanupHook();

    // 添加开发环境测试消息定时器
    if (process.env.NODE_ENV === 'development') {
      this.testMessageInterval = setInterval(() => {
        this.publish('TestMessage', 'HELLO!', 'main');
      }, 1000);
    }
  }

  /**
   * 获取DataManager单例实例
   */
  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  /**
   * 验证发布者ID格式
   * @param publisher 发布者ID
   * @returns 验证结果
   */
  private validatePublisher(publisher: string): boolean {
    return publisher === 'main' || /^app:[a-zA-Z0-9_-]+$/.test(publisher);
  }

  /**
   * 验证订阅者ID格式
   * @param subscriber 订阅者ID
   * @returns 验证结果
   */
  private validateSubscriber(subscriber: string): boolean {
    return subscriber === 'main' || /^app:[a-zA-Z0-9_-]+$/.test(subscriber);
  }

  /**
   * 发布数据到指定主题
   * @param topic 主题名称
   * @param data 要发布的数据
   * @param publisher 发布者ID
   * @returns 是否发布成功
   */
  public publish<T = any>(topic: string, data: T, publisher: string): boolean {
    // 验证发布者
    if (!this.validatePublisher(publisher)) {
      console.error(`Invalid publisher format: ${publisher}. Must be 'main' or 'app:{appId}'`);
      return false;
    }

    // 创建数据项
    const dataItem: BlackboardDataItem<T> = {
      value: data,
      timestamp: Date.now(),
      publisher
    };

    // 更新黑板数据
    this.blackboard.set(topic, dataItem);
    console.debug(`Published data to topic ${topic} by ${publisher}`);

    // 通知订阅者
    this.notifySubscribers(topic, dataItem);
    return true;
  }

  /**
   * 订阅指定主题
   * @param topic 主题名称
   * @param subscriber 订阅者ID
   * @param type 订阅者类型
   * @param callback 回调函数
   * @returns 是否订阅成功
   */
  public subscribe(topic: string, subscriber: string, type: "main" | "obs" | "client", callback: (data: BlackboardDataItem) => void): boolean {
    // 验证订阅者
    if (!this.validateSubscriber(subscriber)) {
      console.error(`Invalid subscriber format: ${subscriber}. Must be 'main' or 'app:{appId}'`);
      return false;
    }
  
    // 如果主题不存在，则创建
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }
  
    // 检查是否已经订阅
    const existingSubscribers = this.subscribers.get(topic);
    if (existingSubscribers?.some(s => s.id === subscriber && s.type === type)) {
      console.warn(`Subscriber ${subscriber} (${type}) is already subscribed to topic ${topic}`);
      return false;
    }
  
    // 添加订阅者
    existingSubscribers?.push({ id: subscriber, type, callback });
    console.debug(`Subscriber ${subscriber} (${type}) subscribed to topic ${topic}`);
  
    // 如果主题已有数据，立即通知新订阅者
    const currentData = this.blackboard.get(topic);
    if (currentData) {
      callback(currentData);
    }
  
    return true;
  }

  /**
   * 取消订阅指定主题
   * @param topic 主题名称
   * @param subscriber 订阅者ID
   * @returns 是否取消成功
   */
  public unsubscribe(topic: string, subscriber: string): boolean {
    if (!this.subscribers.has(topic)) {
      return false;
    }

    const subscribers = this.subscribers.get(topic);
    const initialLength = subscribers?.length || 0;

    // 过滤掉要取消订阅的订阅者
    const updatedSubscribers = subscribers?.filter(s => s.id !== subscriber);
    if (updatedSubscribers) {
      if (updatedSubscribers.length === 0) {
        this.subscribers.delete(topic);
      } else {
        this.subscribers.set(topic, updatedSubscribers);
      }
    }

    console.debug(`Subscriber ${subscriber} unsubscribed from topic ${topic}`);
    return initialLength > (subscribers?.length || 0);
  }

  /**
   * 获取主题的当前数据
   * @param topic 主题名称
   * @returns 主题数据或undefined
   */
  public getTopicData<T = any>(topic: string): BlackboardDataItem<T> | undefined {
    return this.blackboard.get(topic) as BlackboardDataItem<T>;
  }

  /**
   * 获取所有主题名称
   * @returns 主题名称数组
   */
  public getTopics(): string[] {
    return Array.from(this.blackboard.keys());
  }

  /**
   * 通知所有订阅者有新数据
   * @param topic 主题名称
   * @param data 数据项
   */
  private notifySubscribers(topic: string, data: BlackboardDataItem): void {
    const subscribers = this.subscribers.get(topic);
    if (!subscribers || subscribers.length === 0) {
      return;
    }

    subscribers.forEach(subscriber => {
      try {
        subscriber.callback(data);
      } catch (error) {
        console.error(`Error in subscriber ${subscriber.id} callback for topic ${topic}:`, error);
      }
    });
  }

  /**
   * 清理指定应用的所有订阅和发布的数据
   * @param appId 应用ID
   */
  public cleanupAppData(appId: string): void {
    const appPrefix = `app:${appId}`;

    // 清理该应用发布的数据
    this.blackboard.forEach((data, topic) => {
      if (data.publisher === appPrefix) {
        this.blackboard.delete(topic);
        console.debug(`Removed data published by ${appPrefix} from topic ${topic}`);
      }
    });

    // 清理该应用的订阅
    this.subscribers.forEach((subscribers, topic) => {
      const initialLength = subscribers.length;
      const newSubscribers = subscribers.filter(s => s.id !== appPrefix);

      if (newSubscribers.length < initialLength) {
        if (newSubscribers.length === 0) {
          this.subscribers.delete(topic);
        } else {
          this.subscribers.set(topic, newSubscribers);
        }
        console.debug(`Removed ${initialLength - newSubscribers.length} subscriptions from ${appPrefix} on topic ${topic}`);
      }
    });
  }

  /**
   * 设置应用关闭时的清理钩子
   */
  public setAppManager(appManager: AppManager): void {
    this.appManager = appManager;
    this.setupCleanupHook();
  }

  /**
   * 设置应用关闭时的清理钩子
   */
  private setupCleanupHook(): void {
    // 检查appManager是否存在
    if (!this.appManager) {
      console.error('AppManager is not available, cleanup hook not initialized');
      return;
    }

    // 使用命名函数以便后续移除监听器
    const handleAppClosed = (appId: string) => {
      this.cleanupAppData(appId);
    };

    // 监听应用关闭事件，清理相关数据
    this.appManager.on('app-closed', handleAppClosed);

    // 当DataManager实例销毁时移除监听器
    this.on('destroy', () => {
      this.appManager!.off('app-closed', handleAppClosed);
      // 清除测试消息定时器
      if (this.testMessageInterval) {
        clearInterval(this.testMessageInterval);
      }
    });
  }

  /**
   * 按类型清理所有订阅
   * @param type 订阅者类型
   */
  public cleanupByType(type: "main" | "obs" | "client"): void {
    this.subscribers.forEach((subscribers, topic) => {
      const initialLength = subscribers.length;
      const newSubscribers = subscribers.filter(s => s.type !== type);
  
      if (newSubscribers.length < initialLength) {
        if (newSubscribers.length === 0) {
          this.subscribers.delete(topic);
        } else {
          this.subscribers.set(topic, newSubscribers);
        }
        console.debug(`Removed ${initialLength - newSubscribers.length} ${type} subscriptions from topic ${topic}`);
      }
    });
  }
  
  /**
   * 按类型和主题清理订阅
   * @param type 订阅者类型
   * @param topic 主题名称
   */
  public cleanupByTypeAndTopic(type: "main" | "obs" | "client", topic: string): void {
    if (!this.subscribers.has(topic)) {
      return;
    }
  
    const subscribers = this.subscribers.get(topic);
    const initialLength = subscribers?.length || 0;
    const newSubscribers = subscribers?.filter(s => s.type !== type);
  
    if (newSubscribers && newSubscribers.length < initialLength) {
      if (newSubscribers.length === 0) {
        this.subscribers.delete(topic);
      } else {
        this.subscribers.set(topic, newSubscribers);
      }
      console.debug(`Removed ${initialLength - newSubscribers.length} ${type} subscriptions from topic ${topic}`);
    }
  }
  
  /**
   * 处理客户端窗口关闭
   * @param appId 应用ID
   */
  public handleClientClosed(appId: string): void {
    this.cleanupAppData(appId);
  }
  
  /**
   * 处理连接关闭（针对obs和main类型）
   * @param type 订阅者类型
   */
  public handleConnectionClosed(type: "obs" | "main"): void {
    this.cleanupByType(type);
  }
}

// 初始化并注册到全局
globalThis.dataManager = DataManager.getInstance();