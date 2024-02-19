import { ipcMain } from "electron";
import MainWin from "./mainwin";
import { shell } from "electron";
import File from "./file";
import { appStatic } from "./paths";
import { port } from "./http";
import { isRunningInDevServer } from "../sysUtils";
const path = require("path");
const fs = require("fs");
class LegacyApplet {
	static running: any = {};
	static registerEvents() {
		ipcMain.on("legacyApplet_start", LegacyApplet.init);
		ipcMain.on("legacyApplet_list", LegacyApplet.list);
	}

	static init(event: any, data: any) {
		const { name, configurations, path } = JSON.parse(data);
		if (!configurations.multiple && LegacyApplet.running[name]) {
			const { win } = LegacyApplet.running[name];
			if (win.isMinimized()) win.restore();
			win.focus();
			return;
		}
		const win = MainWin.newWindow(configurations);
		win.once("ready-to-show", () => {
			win.show();
			// win.webContents.openDevTools();
		});
		win.webContents.on("new-window", function(e, url) {
			e.preventDefault();
			shell.openExternal(url);
		});
		win.on("close", () => {
			if (configurations.multiple && LegacyApplet.running[name]) {
				LegacyApplet.running[name] = LegacyApplet.running[name].filter(
					(wn: any) => win.webContents.id !== wn.win.webContents.id
				);
			} else {
				LegacyApplet.running[name] = null;
			}
		});
		const ip = require("ip");
		let url: any = `${
			isRunningInDevServer()
				? <string>process.env.VITE_DEV_SERVER_URL
				: `http://${ip.address()}:${port}/`
		}legacyApplet`;
		url = new URL(url);
		url += `?name=${encodeURIComponent(name)}&path=${encodeURIComponent(
			path
		)}&configurations=${encodeURIComponent(data)}`;
		win.loadURL(url).then(() => {
			win.title = `旧式小程序 ${name}`;
		});
		if (isRunningInDevServer()) win.webContents.openDevTools();
		MainWin.registerEvents(win);
		const output = {
			name,
			win
		};
		if (configurations.multiple) {
			LegacyApplet.running[name]
				? LegacyApplet.running[name].push(output)
				: (LegacyApplet.running[name] = [output]);
		} else {
			LegacyApplet.running[name] = {
				name,
				win
			};
		}
	}

	static async list(event: any) {
		const rootPath = path.join(appStatic, "legacyApplets");
		const files = File.getFileList({}, JSON.stringify({ url: rootPath }));
		// console.log(files);
		const result: any = [];
		for (const filePath of files) {
			const target = path.join(rootPath, filePath, "index.vue");
			const targetJson = path.join(rootPath, filePath, "config.json");
			if (!fs.existsSync(target) || !fs.existsSync(targetJson)) continue;
			const obsEntryFilePath = path.join(rootPath, filePath, "obs.vue");
			// TODO: REFACTOR: 使用接口定义 configurations 的数据结构
			const configurations = JSON.parse(
				fs.readFileSync(targetJson, "utf8")
			);
			if (fs.existsSync(obsEntryFilePath)) {
				configurations.obsPath = path.join(
					"/legacyApplets",
					filePath,
					"obs.vue"
				);
				if (!configurations.tags)
					configurations.tags = [];
				configurations.tags.push("OBS投射");
			}
			configurations.path = path.join("/legacyApplets", filePath, "index.vue");
			result.push(configurations);
		}
		event.reply("legacyApplet_list_ack", JSON.stringify(result));
	}
}

export default LegacyApplet;
