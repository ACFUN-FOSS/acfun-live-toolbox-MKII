// TODO: REFACTOR: 重命名 MainWin 字眼，实际上不管是主窗口还是小程序都是用的 MainWin 类来新建窗口。

import { ipcMain, BrowserWindow, screen, IpcMainInvokeEvent } from "electron";
import path, { join } from "path";
import process from "process";

const preload = join(__dirname, "../preload/index.js");

// TODO: REFACTOR: 为 win 创建一个接口用于描述其数据结构
let wins: any = [];
let registered = false;
class MainWin {
	static registerEvents(mainWindow: BrowserWindow) {
		// TODO: REFACTOR: 为 win 创建一个接口用于描述其数据结构
		const win = {
			id: mainWindow.webContents.id,
			win: mainWindow,
			timer: null
		};
		wins.push(win);
		if (!registered) {
			const methods = {
				mainwin_reload: MainWin.reload,
				mainwin_setTop: MainWin.setTop,
				mainwin_setResizeable: MainWin.setResizeable,
				mainwin_setIgnoreMouseEvent: MainWin.setIgnoreMouseEvent,

				win_minimize: MainWin.minimize,
				win_openDevtools: MainWin.openDevtools,
				win_restore: MainWin.restore,
				win_setBounds: MainWin.setBounds,
				win_getPos: MainWin.getPos,
			};
			for (const eventName in methods) {
				ipcMain.on(eventName, methods[eventName]);
			}
			
			registered = true;
		}
		MainWin.startMouseDetector(win);
		mainWindow.on("close", () => {
			const timer: any = win.timer;
			clearTimeout(timer);
			wins = wins.filter((wn: any) => wn.id !== win.id);
		});
	}

	static getPos(event: IpcMainInvokeEvent) {
		event.sender.send("win_getPos_ack", (wins.find((wn: any) => wn.id === event.sender.id).win as BrowserWindow).getPosition());
	}

	static setBounds(event: any, bounds: Partial<Electron.Rectangle>) {
		(wins.find((wn: any) => wn.id === event.sender.id).win as BrowserWindow).setBounds(bounds);
	}

	// TODO: REFACTOR: 名字改成 getEventWin
	static selectWindow(event: any) {
		return wins.find((win: any) => win.id === event.sender.id);
	}

	static reload(event: any) {
		const win = MainWin.selectWindow(event).win as BrowserWindow;
		if (!win) return;
		win.reload();
	}

	static restore(event: any) {
		const win = MainWin.selectWindow(event).win as BrowserWindow;
		if (!win) return;
		win.restore();
	}

	static minimize(event: any) {
		const win = MainWin.selectWindow(event).win as BrowserWindow;
		if (!win) return;
		win.minimize();
	}

	static openDevtools(event: any) {
		const win = MainWin.selectWindow(event).win as BrowserWindow;
		if (!win) return;
		win.webContents.openDevTools();
	}

	static setTop(event: any, data: any) {
		const win = MainWin.selectWindow(event).win as BrowserWindow;
		if (!win) return;
		const { isTop } = JSON.parse(data);
		win.setAlwaysOnTop(isTop, "screen-saver", 1);
		win.setVisibleOnAllWorkspaces(isTop);
		win.setFullScreenable(!isTop);
	}

	static setResizeable(event: any, data: any) {
		const win = MainWin.selectWindow(event).win as BrowserWindow;
		if (!win) return;
		const { isResizeable }: any = JSON.parse(data);
		win.setResizable(isResizeable);
		if (isResizeable && process.platform === "linux") {
			win.setMinimumSize(300, 200);
			win.setMaximumSize(0, 0);
		}
	}

	static setFocusable(event: any, data: any) {
		const win = MainWin.selectWindow(event).win as BrowserWindow;
		if (!win) return;
		const { isFocusable }: any = JSON.parse(data);
		win.setFocusable(isFocusable);
	}

	static setIgnoreMouseEvent(event: any, data: any) {
		const win = MainWin.selectWindow(event).win as BrowserWindow;
		if (!win) return;
		const { ignore }: any = JSON.parse(data);
		win.setIgnoreMouseEvents(ignore, {
			forward: true
		});
		if (!ignore) {
			win.focus();
		}
	}

	static startMouseDetector(wi: any) {
		const { timer, id }: any = wi;
		const win = wi.win as BrowserWindow;
		clearTimeout(timer);
		try {
			const { x, y } = screen.getCursorScreenPoint();
			const winPos = win.getContentBounds();
			if (
				x > winPos.x &&
				y > winPos.y &&
				x - winPos.width < winPos.x &&
				y - winPos.height < winPos.y
			) {
				win.webContents.send("hover", true);
			} else {
				win.webContents.send("hover", false);
			}
		} catch (error) {}
		wi.timer = setTimeout(() => {
			MainWin.startMouseDetector(wi);
		}, 1000);
	}

	static newWindow(options: any = {}) {
		return new BrowserWindow({
			width: 1048,
			height: 724,
			minWidth: 300,
			minHeight: 200,
			frame: false,
			show: false,
			resizable: process.env.NODE_ENV !== "production",
			transparent: true,
			hasShadow: false,
			webPreferences: {
				// offscreen: true,
				nodeIntegration: true,
				contextIsolation: false,
				webSecurity: false,
				allowRunningInsecureContent: true,
				enableBlinkFeatures: "CSSVariables",
				enableRemoteModule: true,
				webviewTag: true,
				preload
			},
			...options
		});
	}

	static closeAll() {
		wins.forEach((win: any) => {
			try {
				win.win.close();
			} catch (error) {}
		});
	}
}
export default MainWin;
