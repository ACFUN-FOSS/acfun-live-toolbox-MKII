/**
 * 示例插件 - 用于测试插件系统的错误处理和日志功能
 */

class ExamplePlugin {
  constructor(api) {
    this.api = api;
    this.name = '示例插件';
    this.version = '1.0.0';
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * 插件初始化
   */
  async initialize() {
    try {
      this.api.logger.info('示例插件正在初始化...');
      
      // 模拟一些初始化工作
      await this.setupEventListeners();
      await this.loadConfiguration();
      
      this.api.logger.info('示例插件初始化完成');
      return true;
    } catch (error) {
      this.api.logger.error('示例插件初始化失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 启动插件
   */
  async start() {
    try {
      if (this.isRunning) {
        this.api.logger.warn('插件已经在运行中');
        return;
      }

      this.api.logger.info('启动示例插件...');
      this.isRunning = true;

      // 启动定时任务
      this.intervalId = setInterval(() => {
        this.performPeriodicTask();
      }, 30000); // 每30秒执行一次

      this.api.logger.info('示例插件启动成功');
    } catch (error) {
      this.api.logger.error('启动插件失败', { error: error.message });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止插件
   */
  async stop() {
    try {
      this.api.logger.info('停止示例插件...');
      
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      
      this.isRunning = false;
      this.api.logger.info('示例插件已停止');
    } catch (error) {
      this.api.logger.error('停止插件失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 插件销毁
   */
  async destroy() {
    try {
      this.api.logger.info('销毁示例插件...');
      
      await this.stop();
      this.removeEventListeners();
      
      this.api.logger.info('示例插件已销毁');
    } catch (error) {
      this.api.logger.error('销毁插件失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  async setupEventListeners() {
    // 监听直播间事件
    this.api.events.on('room.enter', this.onRoomEnter.bind(this));
    this.api.events.on('room.leave', this.onRoomLeave.bind(this));
    this.api.events.on('comment.receive', this.onCommentReceive.bind(this));
    
    this.api.logger.debug('事件监听器设置完成');
  }

  /**
   * 移除事件监听器
   */
  removeEventListeners() {
    this.api.events.off('room.enter', this.onRoomEnter.bind(this));
    this.api.events.off('room.leave', this.onRoomLeave.bind(this));
    this.api.events.off('comment.receive', this.onCommentReceive.bind(this));
    
    this.api.logger.debug('事件监听器已移除');
  }

  /**
   * 加载配置
   */
  async loadConfiguration() {
    try {
      const config = await this.api.storage.get('config', {
        enabled: true,
        logLevel: 'info',
        features: {
          autoGreeting: true,
          commentFilter: false
        }
      });
      
      this.config = config;
      this.api.logger.debug('配置加载完成', { config });
    } catch (error) {
      this.api.logger.error('加载配置失败', { error: error.message });
      // 使用默认配置
      this.config = {
        enabled: true,
        logLevel: 'info',
        features: {
          autoGreeting: true,
          commentFilter: false
        }
      };
    }
  }

  /**
   * 定期任务
   */
  performPeriodicTask() {
    try {
      this.api.logger.debug('执行定期任务...');
      
      // 模拟一些工作
      const now = new Date();
      this.api.logger.info(`定期任务执行完成 - ${now.toLocaleString()}`);
      
      // 随机产生一些警告（用于测试）
      if (Math.random() < 0.1) {
        this.api.logger.warn('这是一个随机警告消息', { 
          timestamp: now.toISOString(),
          randomValue: Math.random()
        });
      }
      
      // 极少情况下产生错误（用于测试错误处理）
      if (Math.random() < 0.02) {
        throw new Error('这是一个随机测试错误');
      }
      
    } catch (error) {
      this.api.logger.error('定期任务执行失败', { 
        error: error.message,
        stack: error.stack
      });
    }
  }

  /**
   * 进入直播间事件处理
   */
  onRoomEnter(roomInfo) {
    this.api.logger.info('进入直播间', { 
      roomId: roomInfo.roomId,
      roomName: roomInfo.roomName,
      streamer: roomInfo.streamer
    });
    
    if (this.config.features.autoGreeting) {
      this.api.logger.debug('发送自动问候消息');
      // 这里可以调用API发送弹幕
    }
  }

  /**
   * 离开直播间事件处理
   */
  onRoomLeave(roomInfo) {
    this.api.logger.info('离开直播间', { 
      roomId: roomInfo.roomId,
      duration: roomInfo.duration
    });
  }

  /**
   * 收到评论事件处理
   */
  onCommentReceive(comment) {
    this.api.logger.debug('收到评论', {
      userId: comment.userId,
      username: comment.username,
      content: comment.content,
      timestamp: comment.timestamp
    });
    
    if (this.config.features.commentFilter) {
      // 这里可以实现评论过滤逻辑
      this.api.logger.debug('评论过滤功能已启用');
    }
  }

  /**
   * 获取插件状态
   */
  getStatus() {
    return {
      name: this.name,
      version: this.version,
      isRunning: this.isRunning,
      config: this.config,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }
}

// 导出插件类
module.exports = ExamplePlugin;