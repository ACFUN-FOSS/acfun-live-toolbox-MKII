import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { app } from 'electron';
import path from 'path';
import { getPackageJson } from "./Devars.js";

export class ProcessManager {
    private activeProcesses = new Map<string, ChildProcess>();

    constructor() {
        // 主进程结束时关闭所有子进程
        app.on('will-quit', () => this.killAllProcesses());
    }

    // 启动程序
    async startProcess(executablePath: string, args: string[] = []): Promise<{ code: number; msg: string; }> {
        try {
            if (this.activeProcesses.has(executablePath)) {
                return { code: 500, msg: '程序已在运行' };
            }

            // 判断是否为相对路径，若是则转换为绝对路径
            if (!path.isAbsolute(executablePath)) {
                // 修正路径拼接逻辑，app.getPath("exe") 返回可执行文件路径，应取所在目录
                const rootPath = (await getPackageJson()).appPath;
                executablePath = path.join(rootPath||path.dirname(app.getPath("exe")), executablePath);
            }

            const options: SpawnOptions = {
                windowsHide: true, // 隐藏子进程窗口
            };
            const child = spawn(executablePath, args, options);
            this.activeProcesses.set(executablePath, child);

            child.on('close', () => {
                this.activeProcesses.delete(executablePath);
            });

            child.on('error', (error) => {
                this.activeProcesses.delete(executablePath);
                console.error(`启动进程 ${executablePath} 时出错:`, error);
            });

            return { code: 200, msg: '成功' };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            return { code: 500, msg: `启动程序失败: ${errorMessage}` };
        }
    }

    // 关闭指定程序
    killProcess(executablePath: string): { code: number; msg: string } {
        try {
            const child = this.activeProcesses.get(executablePath);
            if (child) {
                child.kill();
                this.activeProcesses.delete(executablePath);
                return { code: 200, msg: '成功' };
            }
            return { code: 500, msg: '程序未在运行' };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            return { code: 500, msg: `关闭程序失败: ${errorMessage}` };
        }
    }

    // 关闭所有程序
    killAllProcesses(): { code: number; msg: string } {
        try {
            this.activeProcesses.forEach((child, executablePath) => {
                child.kill();
                this.activeProcesses.delete(executablePath);
            });
            return { code: 200, msg: '成功' };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            return { code: 500, msg: `关闭所有程序失败: ${errorMessage}` };
        }
    }

    // 检查程序是否正在运行
    isProcessRunning(executablePath: string): { code: number; msg: string } {
        try {
            const isRunning = this.activeProcesses.has(executablePath);
            return { 
                code: 200, 
                msg: isRunning ? '程序正在运行' : '程序未在运行' 
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            return { code: 500, msg: `检查程序运行状态失败: ${errorMessage}` };
        }
    }

    // 重启指定程序
    async restartProcess(executablePath: string, args: string[] = []): Promise<{ code: number; msg: string; }> {
        try {
            // 先关闭程序
            const killResult = this.killProcess(executablePath);
            if (killResult.code !== 200) {
                return { code: 500, msg: `关闭程序失败，无法重启: ${killResult.msg}` };
            }

            // 再启动程序
            const startResult = await this.startProcess(executablePath, args);
            if (startResult.code !== 200) {
                return { code: 500, msg: `重启程序失败，启动过程出错: ${startResult.msg}` };
            }

            return { code: 200, msg: '程序重启成功' };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            return { code: 500, msg: `重启程序失败: ${errorMessage}` };
        }
    }
}