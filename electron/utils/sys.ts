/**
 * FILENAME: sys.ts
 *
 * DESC: 提供一些与运行环境（node、vite、操作系统）有关的函数。
 */

// TODO: REFACTOR: 标记所有类似 `if(process.env.VITE_DEV_SERVER_URL)` 之
// 代码，换用本函数。
export function isRunningInDevServer() {
	return (
		process.env.VITE_DEV_SERVER_URL && process.env.VITE_DEV_SERVER_URL != ""
	);
}

export function getCacheDir() {
	const path = require("path");
	return path.join(
		require("os").homeDir(),
		isWin32() ? "/acfun-live-toolbox" : ".acfunlive-toolbox"
	);
}

export function isWin32() {
	return process.platform === "win32";
}
