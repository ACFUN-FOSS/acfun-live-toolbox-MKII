import { app, BrowserWindow, shell, protocol, globalShortcut } from "electron";
import { release } from "node:os";
import { join } from "node:path";
import { MainWin, Backend, File, KsApi } from "../subsystem";
import { isRunningInDevServer as isRunningUnderDevServer } from "../subsystem/sys";
import { startHttp } from "../server";

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("ignore-certificate-errors");
if (process.platform === "linux") {
	app.commandLine.appendSwitch("enable-transparent-visuals");
	app.commandLine.appendSwitch("disable-gpu");
}

const isDevelopment = process.env.VITE_DEV_SERVER_URL;

// Disable GPU Acceleration for Windows 7
if (release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
	{ scheme: "app", privileges: { secure: true, standard: true } },
]);

// Remove electron security warnings
// This warning only shows in development mode
// Read more on https://www.electronjs.org/docs/latest/tutorial/security
// process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

let win: BrowserWindow | null = null;

// Here, you can also use other preload
const preload = join(__dirname, "../preload/index.js");
const url = process.env.VITE_DEV_SERVER_URL;
const indexHtml = join(process.env.DIST, "index.html");

async function createWindow() {
	win = MainWin.newWindow();
	win.setMenu(null);
	const gotTheLock = app.requestSingleInstanceLock();
	if (!gotTheLock) {
		app.quit();
	} else {
		app.on("second-instance", (event, commandLine, workingDirectory) => {
			// Someone tried to run a second instance, we should focus our window.
			if (win) {
				if (win.isMinimized()) win.restore();
				win.focus();
			}
		});
	}
	win.once("ready-to-show", () => {
		win.show();
		// win.webContents.openDevTools();
	});
	win.on("close", () => {
		MainWin.closeAll();
	});

	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: "deny" };
	});
	/**
	 * 若于 DEV SERVER 中运行，则：
	 *   - HTTP 服务器会成为「哑巴」，仅仅提供 ws 支持。
	 *   - electron 浏览器载入 VITE DEV SERVER 所 serve 的 index.html。
	 * 否则：
	 * 	 - HTTP 服务器完整功能会发挥作用，除提供 ws 支持外也 serve
	 *     静态文件（包括 index.html）。
	 *   - electron 浏览器载入 HTTP SERVER 所 serve 的 index.html。
	 *
	 * 上述 ws 指工具箱各个实例（electron 窗口、浏览器打开的工具箱界面……）
	 * 之间通信所用的 websocket，并非工具箱与后端通信所用的 websocket。
	 */
	if (isRunningUnderDevServer()) {
		startHttp().then((res: any) => {
			win.loadURL(url);
			// Open devTool if the app is not packaged
			win.webContents.openDevTools();
		});
	} else {
		startHttp().then((res: any) => {
			win.loadURL(res);
			win.webContents.openDevTools();
		});
	}

	globalShortcut.register("CommandOrControl+F1", () => {
		win.webContents.send("switch-ignore-mode");
	});
	globalShortcut.register("CommandOrControl+F2", () => {
		win.webContents.send("switch-ignore-mode-temp");
	});
	globalShortcut.register("CommandOrControl+F3", () => {
		win.webContents.send("resize");
	});

	// TODO: REFACTOR: 这种玩意一律以 subsystem 命名，别放到 utils 里
	Backend.registerEvents();
	File.registerEvents();
	MainWin.registerEvents(win);
	KsApi.registerEvents();
	Backend.init();

	// Test actively push message to the Electron-Renderer
	win.webContents.on("did-finish-load", () => {
		win?.webContents.send(
			"main-process-message",
			new Date().toLocaleString()
		);
	});
}

app.whenReady().then(() => {
	app.on("window-all-closed", () => {
		// On macOS it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		app.quit();
	});
	createWindow();
});

if (isDevelopment || true) {
	if (process.platform === "win32") {
		process.on("message", (data) => {
			if (data === "graceful-exit") {
				app.quit();
			}
		});
	} else {
		process.on("SIGTERM", () => {
			app.quit();
		});
	}
}

// app.on("activate", () => {
// 	const allWindows = BrowserWindow.getAllWindows();
// 	if (allWindows.length) {
// 		allWindows[0].focus();
// 	} else {
// 		createWindow();
// 	}
// });

// New window example arg: new windows url
// ipcMain.handle("open-win", (_, arg) => {
// 	const childWindow = new BrowserWindow({
// 		webPreferences: {
// 			preload,
// 			nodeIntegration: true,
// 			contextIsolation: false,
// 		},
// 	});

// 	if (process.env.VITE_DEV_SERVER_URL) {
// 		childWindow.loadURL(`${url}#${arg}`);
// 	} else {
// 		childWindow.loadFile(indexHtml, { hash: arg });
// 	}
// });
