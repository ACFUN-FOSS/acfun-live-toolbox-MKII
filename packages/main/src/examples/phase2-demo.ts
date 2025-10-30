/**
 * Phase 2 Demo: Persistence & State Management
 * 
 * 这个演示程序展示了第二阶段实现的功能：
 * - SQLite数据库初始化
 * - 事件写入器的批量处理
 * - 房间管理器的多房间管理
 * - 指数退避重连策略
 */

import { DatabaseManager } from '../persistence/DatabaseManager';
import { EventWriter } from '../persistence/EventWriter';
import { RoomManager } from '../rooms/RoomManager';

export class Phase2Demo {
  private databaseManager: DatabaseManager;
  private eventWriter: EventWriter;
  private roomManager: RoomManager;

  constructor() {
    this.databaseManager = new DatabaseManager();
    this.eventWriter = new EventWriter(this.databaseManager);
    this.roomManager = new RoomManager(this.eventWriter);
  }

  public async initialize(): Promise<void> {
    console.log('=== Phase 2 Demo: Initializing ===');
    
    try {
      // 初始化数据库
      console.log('1. Initializing database...');
      await this.databaseManager.initialize();
      console.log('✓ Database initialized successfully');

      // 设置房间管理器事件监听
      this.setupRoomManagerListeners();
      
      console.log('✓ Phase 2 initialization complete');
    } catch (error) {
      console.error('✗ Phase 2 initialization failed:', error);
      throw error;
    }
  }

  public async demonstrateFeatures(): Promise<void> {
    console.log('\n=== Phase 2 Demo: Feature Demonstration ===');

    try {
      // 演示房间管理
      await this.demonstrateRoomManagement();
      
      // 演示事件持久化
      await this.demonstrateEventPersistence();
      
      // 演示重连策略
      await this.demonstrateReconnectionStrategy();
      
    } catch (error) {
      console.error('✗ Feature demonstration failed:', error);
      throw error;
    }
  }

  private async demonstrateRoomManagement(): Promise<void> {
    console.log('\n--- Room Management Demo ---');
    
    // 添加多个房间
    const roomIds = ['12345', '67890', '11111'];
    
    for (const roomId of roomIds) {
      console.log(`Adding room ${roomId}...`);
      const success = await this.roomManager.addRoom(roomId);
      if (success) {
        console.log(`✓ Room ${roomId} added successfully`);
      } else {
        console.log(`✗ Failed to add room ${roomId}`);
      }
      
      // 等待一段时间让连接建立
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 显示房间状态
    console.log('\nCurrent room status:');
    const rooms = this.roomManager.getAllRooms();
    rooms.forEach(room => {
      console.log(`  Room ${room.roomId}: ${room.status} (${room.eventCount} events)`);
    });

    console.log(`Total rooms: ${this.roomManager.getRoomCount()}`);
    console.log(`Connected rooms: ${this.roomManager.getConnectedRoomCount()}`);
  }

  private async demonstrateEventPersistence(): Promise<void> {
    console.log('\n--- Event Persistence Demo ---');
    
    // 等待一些事件被生成和持久化
    console.log('Waiting for events to be generated and persisted...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log(`Event writer queue size: ${this.eventWriter.getQueueSize()}`);
    
    // 强制刷新队列
    console.log('Forcing event queue flush...');
    await this.eventWriter.forceFlush();
    console.log(`✓ Queue flushed, remaining items: ${this.eventWriter.getQueueSize()}`);
  }

  private async demonstrateReconnectionStrategy(): Promise<void> {
    console.log('\n--- Reconnection Strategy Demo ---');
    
    const rooms = this.roomManager.getAllRooms();
    if (rooms.length > 0) {
      const testRoom = rooms[0];
      console.log(`Testing reconnection for room ${testRoom.roomId}...`);
      
      // 手动触发重连
      const success = await this.roomManager.reconnectRoom(testRoom.roomId);
      if (success) {
        console.log(`✓ Room ${testRoom.roomId} reconnection initiated`);
      } else {
        console.log(`✗ Failed to initiate reconnection for room ${testRoom.roomId}`);
      }
    }
  }

  private setupRoomManagerListeners(): void {
    this.roomManager.on('roomAdded', (roomId: string) => {
      console.log(`[Event] Room added: ${roomId}`);
    });

    this.roomManager.on('roomRemoved', (roomId: string) => {
      console.log(`[Event] Room removed: ${roomId}`);
    });

    this.roomManager.on('roomStatusChange', (roomId: string, status: string) => {
      console.log(`[Event] Room ${roomId} status changed to: ${status}`);
    });

    this.roomManager.on('event', (event: any) => {
      console.log(`[Event] Received event from room ${event.roomId}: ${event.type}`);
    });

    this.roomManager.on('roomError', (roomId: string, error: Error) => {
      console.log(`[Event] Room ${roomId} error: ${error.message}`);
    });

    this.roomManager.on('roomReconnectFailed', (roomId: string) => {
      console.log(`[Event] Room ${roomId} reconnection failed after maximum attempts`);
    });
  }

  public async shutdown(): Promise<void> {
    console.log('\n=== Phase 2 Demo: Shutting down ===');
    
    try {
      // 关闭房间管理器
      console.log('1. Shutting down room manager...');
      await this.roomManager.shutdown();
      console.log('✓ Room manager shut down');

      // 关闭事件写入器
      console.log('2. Shutting down event writer...');
      await this.eventWriter.shutdown();
      console.log('✓ Event writer shut down');

      // 关闭数据库
      console.log('3. Closing database...');
      await this.databaseManager.close();
      console.log('✓ Database closed');

      console.log('✓ Phase 2 demo shutdown complete');
    } catch (error) {
      console.error('✗ Shutdown failed:', error);
      throw error;
    }
  }
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
  const demo = new Phase2Demo();
  
  const runDemo = async () => {
    try {
      await demo.initialize();
      await demo.demonstrateFeatures();
      
      // 运行30秒后关闭
      setTimeout(async () => {
        await demo.shutdown();
        process.exit(0);
      }, 30000);
      
    } catch (error) {
      console.error('Demo failed:', error);
      process.exit(1);
    }
  };

  runDemo();
}