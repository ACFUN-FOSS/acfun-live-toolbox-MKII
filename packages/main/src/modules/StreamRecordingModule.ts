import { singleton } from 'tsyringe';
import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger';
import { ConfigManager } from '../utils/ConfigManager';

@singleton()
export class StreamRecordingModule {
  private recordingsPath: string;
  private isRecording: boolean = false;
  private currentProcess: any = null;
  private configManager: ConfigManager;
  private currentRecordingFile: string = '';

  constructor() {
    this.configManager = new ConfigManager();
    this.recordingsPath = join(this.configManager.getConfigPath(), 'recordings');
    // 确保录制目录存在
    if (!existsSync(this.recordingsPath)) {
      mkdirSync(this.recordingsPath, { recursive: true });
    }
  }

  /**
   * 开始录制直播
   * @param roomId 直播间ID
   * @param quality 录制质量 (high, medium, low)
   * @returns 录制文件名
   */
  startRecording(roomId: number, quality: 'high' | 'medium' | 'low' = 'high'): string {
    if (this.isRecording) {
      throw new Error('已有录制任务正在进行中');
    }

    try {
      // 生成录制文件名
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `acfun_${roomId}_${timestamp}.flv`;
      this.currentRecordingFile = filename;
      const outputPath = join(this.recordingsPath, filename);

      // 获取直播流地址 (实际应用中需要从ACFUN API获取真实流地址)
      const streamUrl = this.getStreamUrl(roomId, quality);

      // 使用ffmpeg录制流 (需要确保系统已安装ffmpeg)
      this.currentProcess = spawn('ffmpeg', [
        '-i', streamUrl,
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-y', // 覆盖已存在文件
        outputPath
      ]);

      this.isRecording = true;

      // 记录日志
      this.currentProcess.stdout.on('data', (data: Buffer) => {
        logger.info(`录制输出: ${data.toString().trim()}`);
      });

      this.currentProcess.stderr.on('data', (data: Buffer) => {
        logger.error(`录制错误: ${data.toString().trim()}`);
      });

      this.currentProcess.on('close', (code: number) => {
        this.isRecording = false;
        this.currentProcess = null;
        this.updateRecordingMetadata(filename, 'completed');
        logger.info(`录制进程已退出，代码: ${code}`);
      });

      // 记录录制元数据
      this.saveRecordingMetadata(filename, roomId, quality);

      return filename;
    } catch (error) {
      logger.error('开始录制失败:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * 停止录制
   */
  stopRecording(): boolean {
    if (!this.isRecording || !this.currentProcess) {
      return false;
    }

    try {
      // 优雅地结束ffmpeg进程
      this.currentProcess.kill('SIGINT');
      this.isRecording = false;
      this.updateRecordingMetadata(this.currentRecordingFile, 'stopped');
      return true;
    } catch (error) {
      logger.error('停止录制失败:', error);
      return false;
    }
  }

  /**
   * 获取录制状态
   */
  getRecordingStatus(): { isRecording: boolean; currentFile?: string; recordingsPath: string } {
    return {
      isRecording: this.isRecording,
      currentFile: this.currentRecordingFile || undefined,
      recordingsPath: this.recordingsPath
    };
  }

  /**
   * 获取录制文件列表
   */
  getRecordingList(): { name: string; size: number; date: Date }[] {
    try {
      const files = readdirSync(this.recordingsPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && dirent.name.endsWith('.flv'))
        .map(file => {
          const stats = file.statSync();
          return {
            name: file.name,
            size: stats.size,
            date: new Date(stats.mtime)
          };
        });

      // 按日期降序排序
      return files.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      logger.error('获取录制列表失败:', error);
      return [];
    }
  }

  /**
   * 获取直播流地址 (模拟实现)
   * @param roomId 直播间ID
   * @param quality 质量
   */
  private getStreamUrl(roomId: number, quality: string): string {
    // 实际应用中需要从ACFUN API获取真实的流地址
    const qualityParams = {
      high: '1080p',
      medium: '720p',
      low: '480p'
    };
    // 这里使用模拟地址，实际项目中需替换为真实API调用
    return `https://live.acfun.cn/api/stream/${roomId}?quality=${qualityParams[quality]}`;
  }

  /**
   * 保存录制元数据
   */
  private saveRecordingMetadata(filename: string, roomId: number, quality: string): void {
    const metadata = {
      filename,
      roomId,
      quality,
      startTime: new Date().toISOString(),
      status: 'recording',
      fileSize: 0
    };

    const metadataPath = join(this.recordingsPath, `${filename}.json`);
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }

  /**
   * 更新录制元数据
   */
  private updateRecordingMetadata(filename: string, status: 'completed' | 'stopped' | 'failed'): void {
    try {
      const metadataPath = join(this.recordingsPath, `${filename}.json`);
      if (existsSync(metadataPath)) {
        // 实际实现中应读取并更新现有元数据
        const metadata = {
          ...require(metadataPath),
          status,
          endTime: new Date().toISOString()
        };
        writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
      }
    } catch (error) {
      logger.error('更新录制元数据失败:', error);
    }
  }
}