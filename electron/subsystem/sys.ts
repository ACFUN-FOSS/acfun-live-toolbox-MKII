/**
 * FILENAME: sys.ts
 *
 * DESC: 提供一些与运行环境（node、vite、操作系统）有关的函数。
 */

export function execPromise(cmd) {
	const { exec } = require("child_process");
	return new Promise((resolve) => exec(cmd, resolve));
}

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
		require("os").homedir(),
		isWin32() ? "/acfun-live-toolbox" : ".acfunlive-toolbox"
	);
}

//解决premission denied的问题
export async function clearPort() {
	if (isWin32()) {
		await execPromise("net stop winnat");
		await execPromise("net start winnat");
	}
}

export function isWin32() {
	return process.platform === "win32";
}
