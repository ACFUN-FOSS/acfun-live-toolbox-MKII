/**
 * FILENAME: sys.ts
 * 
 * DESC: 提供一些与运行环境（node、vite、操作系统）有关的函数。
 */

// TODO: REFACTOR: 标记所有类似 `if(process.env.VITE_DEV_SERVER_URL)` 之
// 代码，换用本函数。
export function isRunningInDevServer() {
    return process.env.VITE_DEV_SERVER_URL && process.env.VITE_DEV_SERVER_URL != "";
}