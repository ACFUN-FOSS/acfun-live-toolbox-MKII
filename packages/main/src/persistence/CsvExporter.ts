import { QueryService, EventQuery } from './QueryService';
import { NormalizedEvent } from '../types';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface ExportOptions extends EventQuery {
  filename?: string;
  includeRaw?: boolean;
}

export interface ExportResult {
  filename: string;
  filepath: string;
  recordCount: number;
  fileSize: number;
}

export class CsvExporter {
  private queryService: QueryService;
  private exportDir: string;

  constructor(queryService: QueryService) {
    this.queryService = queryService;
    
    // 默认导出目录：userData/exports/
    const userDataPath = app.getPath('userData');
    this.exportDir = path.join(userDataPath, 'exports');
    
    // 确保导出目录存在
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  public async exportToCsv(options: ExportOptions): Promise<ExportResult> {
    const {
      filename,
      includeRaw = false,
      ...queryOptions
    } = options;

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const finalFilename = filename || `events-${timestamp}.csv`;
    const filepath = path.join(this.exportDir, finalFilename);

    // 创建写入流
    const writeStream = fs.createWriteStream(filepath, { encoding: 'utf8' });

    try {
      // 写入 CSV 头部
      const headers = [
        'ts',
        'room_id', 
        'event_type',
        'user_id',
        'user_name',
        'content'
      ];

      if (includeRaw) {
        headers.push('raw');
      }

      writeStream.write(headers.join(',') + '\n');

      // 分页查询并写入数据
      let page = 1;
      let recordCount = 0;
      const pageSize = 1000; // 大批量导出时使用较大的页面大小

      while (true) {
        const result = await this.queryService.queryEvents({
          ...queryOptions,
          page,
          pageSize
        });

        if (result.items.length === 0) {
          break;
        }

        // 写入当前页的数据
        for (const event of result.items) {
          const row = this.formatEventToCsvRow(event, includeRaw);
          writeStream.write(row + '\n');
          recordCount++;
        }

        // 如果没有更多数据，退出循环
        if (!result.hasNext) {
          break;
        }

        page++;
      }

      // 关闭写入流
      await new Promise<void>((resolve, reject) => {
        writeStream.end((err?: Error) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // 获取文件大小
      const stats = fs.statSync(filepath);
      const fileSize = stats.size;

      return {
        filename: finalFilename,
        filepath,
        recordCount,
        fileSize
      };

    } catch (error) {
      // 清理失败的文件
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      throw error;
    }
  }

  private formatEventToCsvRow(event: NormalizedEvent, includeRaw: boolean): string {
    const values = [
      event.ts.toString(),
      this.escapeCsvValue(event.room_id),
      this.escapeCsvValue(event.event_type),
      this.escapeCsvValue(event.user_id || ''),
      this.escapeCsvValue(event.user_name || ''),
      this.escapeCsvValue(event.content || '')
    ];

    if (includeRaw) {
      const rawJson = event.raw ? JSON.stringify(event.raw) : '';
      values.push(this.escapeCsvValue(rawJson));
    }

    return values.join(',');
  }

  private escapeCsvValue(value: string): string {
    if (!value) return '';
    
    // 如果包含逗号、引号或换行符，需要用引号包围并转义内部引号
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }

  public getExportDir(): string {
    return this.exportDir;
  }

  public setExportDir(dir: string): void {
    this.exportDir = dir;
    
    // 确保目录存在
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  public async listExportFiles(): Promise<Array<{
    filename: string;
    filepath: string;
    size: number;
    createdAt: Date;
  }>> {
    if (!fs.existsSync(this.exportDir)) {
      return [];
    }

    const files = fs.readdirSync(this.exportDir);
    const csvFiles = files.filter(file => file.endsWith('.csv'));

    const fileInfos = csvFiles.map(filename => {
      const filepath = path.join(this.exportDir, filename);
      const stats = fs.statSync(filepath);
      
      return {
        filename,
        filepath,
        size: stats.size,
        createdAt: stats.birthtime
      };
    });

    // 按创建时间降序排列
    return fileInfos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async deleteExportFile(filename: string): Promise<boolean> {
    const filepath = path.join(this.exportDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return false;
    }

    try {
      fs.unlinkSync(filepath);
      return true;
    } catch (error) {
      console.error('Error deleting export file:', error);
      return false;
    }
  }
}