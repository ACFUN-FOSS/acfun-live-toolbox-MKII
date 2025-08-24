import express, { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { app, ipcMain } from 'electron';
import { getLogManager } from '../utils/LogManager.js';
import { acfunDanmuModule } from '../modules/AcfunDanmuModule.js';

// 创建路由器
const router: Router = express.Router();
const logManager = getLogManager();

/**
 * 文件操作相关接口
 */
// 读取文件
router.get('/file/read', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ success: false, error: '文件路径不能为空' });
    }
    const content = await fs.readFile(filePath, 'utf8');
    return res.json({ success: true, data: content });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `读取文件失败: ${errMsg}` });
  }
});

// 写入文件
router.post('/file/write', async (req: Request, res: Response) => {
  try {
    const { filePath, content } = req.body;
    if (!filePath || !content) {
      return res.status(400).json({ success: false, error: '文件路径和内容不能为空' });
    }
    await fs.writeFile(filePath, content, 'utf8');
    return res.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `写入文件失败: ${errMsg}` });
  }
});

// 删除文件
router.delete('/file/delete', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ success: false, error: '文件路径不能为空' });
    }
    await fs.unlink(filePath);
    return res.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `删除文件失败: ${errMsg}` });
  }
});

// 列出目录
router.get('/file/list', async (req: Request, res: Response) => {
  try {
    const { dirPath } = req.query;
    if (!dirPath || typeof dirPath !== 'string') {
      return res.status(400).json({ success: false, error: '目录路径不能为空' });
    }
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    const result = files.map(file => ({
      name: file.name,
      isDirectory: file.isDirectory(),
      isFile: file.isFile()
    }));
    return res.json({ success: true, data: result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `列出目录失败: ${errMsg}` });
  }
});

/**
 * 进程操作相关接口
 */
// 启动进程
router.post('/process/start', (req: Request, res: Response) => {
  try {
    const { command, args, cwd } = req.body;
    if (!command) {
      return res.status(400).json({ success: false, error: '命令不能为空' });
    }

    // 通过ipcMain发送消息给主进程，由主进程启动子进程
    ipcMain.emit('start-process', { command, args, cwd });

    return res.json({ success: true, message: '进程启动请求已发送' });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `启动进程失败: ${errMsg}` });
  }
});

// 终止进程
router.post('/process/stop', (req: Request, res: Response) => {
  try {
    const { pid } = req.body;
    if (typeof pid !== 'number') {
      return res.status(400).json({ success: false, error: '进程ID不能为空' });
    }

    // 通过ipcMain发送消息给主进程，由主进程终止子进程
    ipcMain.emit('stop-process', { pid });

    return res.json({ success: true, message: '进程终止请求已发送' });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `终止进程失败: ${errMsg}` });
  }
});

// 获取进程列表
router.get('/process/list', (req: Request, res: Response) => {
  try {
    // 使用Promise方式获取进程列表
    new Promise((resolve, reject) => {
      // 设置临时监听器
      const listener = (event: any, processes: any[]) => {
        ipcMain.removeListener('process-list-response', listener);
        resolve(processes);
      };
      ipcMain.once('process-list-response', listener);
      // 发送获取进程列表的请求
      ipcMain.emit('get-process-list');
      // 设置超时
      setTimeout(() => {
        ipcMain.removeListener('process-list-response', listener);
        reject(new Error('获取进程列表超时'));
      }, 5000);
    }).then((processes: any) => {
      return res.json({ success: true, data: processes });
    }).catch((error) => {
      const errMsg = error instanceof Error ? error.message : '未知错误';
      return res.status(500).json({ success: false, error: `获取进程列表失败: ${errMsg}` });
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `获取进程列表失败: ${errMsg}` });
  }
});

/**
 * acfunDanmu模块管理接口
 */
// 启动acfunDanmu模块
router.post('/acfun/start', (req: Request, res: Response) => {
  try {
    const result = acfunDanmuModule.enable();
    return res.json({ success: result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `启动acfunDanmu模块失败: ${errMsg}` });
  }
});

// 停止acfunDanmu模块
router.post('/acfun/stop', (req: Request, res: Response) => {
  try {
    const result = acfunDanmuModule.disable();
    return res.json({ success: result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `停止acfunDanmu模块失败: ${errMsg}` });
  }
});

// 重启acfunDanmu模块
router.post('/acfun/restart', (req: Request, res: Response) => {
  try {
    acfunDanmuModule.disable();
    const result = acfunDanmuModule.enable();
    return res.json({ success: result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `重启acfunDanmu模块失败: ${errMsg}` });
  }
});

// 更新acfunDanmu模块配置
router.post('/acfun/config/update', (req: Request, res: Response) => {
  try {
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ success: false, error: '配置不能为空' });
    }
    const result = acfunDanmuModule.updateConfig(config);
    return res.json({ success: result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `更新acfunDanmu模块配置失败: ${errMsg}` });
  }
});

// 获取acfunDanmu模块配置
router.get('/acfun/config/get', (req: Request, res: Response) => {
  try {
    const config = acfunDanmuModule.getConfig();
    return res.json({ success: true, data: config });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `获取acfunDanmu模块配置失败: ${errMsg}` });
  }
});

// 获取acfunDanmu模块状态
router.get('/acfun/status', (req: Request, res: Response) => {
  try {
    const status = acfunDanmuModule.getStatus();
    return res.json({ success: true, data: status });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `获取acfunDanmu模块状态失败: ${errMsg}` });
  }
});

// 获取acfunDanmu模块日志
router.get('/acfun/logs', (req: Request, res: Response) => {
  try {
    const { source, limit = 100, offset = 0 } = req.query;
    const logs = logManager.getLogs(
      source as string | undefined,
      parseInt(limit as string),
      parseInt(offset as string)
    );
    return res.json({ success: true, data: logs });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `获取acfunDanmu模块日志失败: ${errMsg}` });
  }
});

// 应用管理接口
// 获取应用信息
router.get('/app/info', (req: Request, res: Response) => {
  try {
    const appInfo = {
      name: app.getName(),
      version: app.getVersion(),
      path: app.getPath('exe'),
      userData: app.getPath('userData'),
      temp: app.getPath('temp'),
      os: process.platform
    };
    return res.json({ success: true, data: appInfo });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ success: false, error: `获取应用信息失败: ${errMsg}` });
  }
});

// 导出路由器
export const httpApi = router;