import { ipcMain } from "electron";
import { appStatic, configStatic } from "./paths";
import { makeZip, UnZip } from "./zip";
import { randomId } from "./base";
import uniq from "lodash/uniq";
const log = require("electron-log");
log.transports.file.maxSize = 100 * 1024 * 1024;
const path = require("path");
const fs = require("fs");
const ba64 = require("ba64");
const spawn = require("child_process").spawn;
const crypto = require("crypto");
log.transports.file.resolvePath = () =>
	process.platform === "win32"
		? path.join(appStatic, "./../../TellFQZWhatHappened.log")
		: path.join(configStatic, "./TellFQZWhatHappened.log");
export { log };
class File {
	static registerEvents() {
		ipcMain.on("backend_launch", this.launch);
		ipcMain.on("backend_save", this.savePath);
		ipcMain.on("backend_load", this.loadPath);
		ipcMain.on("readConfig", this.readConfig);
		ipcMain.on("backend_save_config", this.saveConfig);
		ipcMain.on("readSuperChatConfig", this.readSuperChatConfig);
		ipcMain.on("saveSuperChatConfig", this.saveSuperChatConfig);
		ipcMain.on("backend_copy", this.copyFile);
		ipcMain.on("saveB64ToImgFile", this.saveB64ToImgFile);
		ipcMain.on("getFontList", this.getFontList);

		ipcMain.on("getVoiceList", this.getVoiceList);
		ipcMain.on("backupConfig", this.backupConfig);
		ipcMain.on("restoreAndReadBackupConfig", this.restoreAndReadBackupConfig);
		ipcMain.on("copyFileWithMd5Name", this.copyFileWithMd5Name);
		ipcMain.on("getCacheSize", this.getCacheSize);
		ipcMain.on("removeCache", this.removeCache);
		ipcMain.on("openFolder", this.openFolder);
		ipcMain.on("openCacheFolder", this.openCacheFolder);
		ipcMain.on("legacyApplet_loadSettings", this.loadLegacyAppletSettings);
		ipcMain.on("legacyApplet_saveSettings", this.saveLegacyAppletSettings);
	}

	static log(event: any, p: any) {
		log.error(p);
	}

	static launch(event: any, p: any) {
		try {
			spawn(p, [], {
				cwd: path.dirname(p),
				detached: true,
			});
		} catch (error) {}
	}

	static async backupConfig(event: any) {
		const zipDir = path.join(appStatic, "backup.zip");
		try {
			await makeZip(configStatic, zipDir);
			event.reply("backupConfig_ack", "/backup.zip");
		} catch (error) {
			event.reply("backupConfig_ack", "#error");
		}
	}

	static async restoreAndReadBackupConfig(event: any, p: any) {
		try {
			await UnZip(p, configStatic);
			const config = File.loadFile(
				path.join(configStatic, "./config.json")
			);
			event.reply("restoreAndReadBackupConfig_ack", config);
		} catch (error) {
			event.reply("restoreAndReadBackupConfig_ack", "#error");
		}
	}

	static loadFile(url: string) {
		try {
			const data = fs.readFileSync(url, "utf8");
			// console.log(data);
			return data;
		} catch (error) {
			console.log(error);
			return "{}";
		}
	}

	static getMd5(filePath: string) {
		try {
			const file = fs.readFileSync(filePath);
			const md5 = crypto.createHash("md5");
			const hash = md5.update(file).digest("hex");
			return hash;
		} catch (e) {
			return "#error";
		}
	}

	static copyFileWithMd5Name(event: any, res: any) {
		// eslint-disable-next-line init-declarations
		let result;
		try {
			let { srcUrl, distUrl } = JSON.parse(res);
			if (!path.isAbsolute(srcUrl))
				srcUrl = path.join(configStatic, srcUrl);
			const md5 = File.getMd5(srcUrl);
			if (!path.isAbsolute(distUrl)) {
				distUrl = path.join(configStatic, distUrl);
			}

			const finalFilePath = path.join(
				distUrl,
				`${md5}${path.extname(srcUrl)}`
			);

			if (!fs.existsSync(finalFilePath)) {
				fs.mkdirSync(path.dirname(finalFilePath), { recursive: true });
				fs.copyFileSync(srcUrl, finalFilePath);
			}
			result = finalFilePath;
		} catch (e) {
			result = "#error";
		} finally {
			event.reply("copyFileWithMd5Name_ack", result);
		}
	}

	static saveFile(url: string, data: any) {
		fs.writeFile(url, JSON.stringify(data), (err: any) => {
			if (err) {
				console.error(err);
			}
		});
	}

	static copyFile(event: any, res: any) {
		let { srcUrl, distUrl } = JSON.parse(res);
		if (!path.isAbsolute(srcUrl)) srcUrl = path.join(configStatic, distUrl);
		if (!path.isAbsolute(distUrl)) {
			distUrl = path.join(configStatic, distUrl);
		}
		fs.mkdirSync(path.dirname(distUrl), { recursive: true });
		fs.copyFile(srcUrl, distUrl, 0, (err: any) => {
			event.reply("copy_file_ack", err ? "#error" : distUrl);
		});
	}

	static saveB64ToImgFile(event: any, b64: any) {
		const imgPath = path.join(configStatic, "/images/");
		const imgName = `image${randomId(8)}`;
		try {
			fs.accessSync(imgPath);
		} catch (error) {
			fs.mkdirSync(imgPath, { recursive: true });
		}
		try {
			ba64.writeImageSync(imgPath + imgName, b64);
			event.reply("saveB64ToImgFile_ack", imgPath + imgName + ".png");
		} catch (error) {
			event.reply("saveB64ToImgFile_ack", "#error");
		}
	}

	static readConfig(event: any | null) {
		// @ts-ignore
		const url = path.join(configStatic, "config.json");
		try {
			fs.accessSync(url);
		} catch (error) {
			// @ts-ignore
			fs.copyFileSync(
				path.join(process.env.VITE_PUBLIC, "default.json"),
				url,
				0
			);
		}
		const reply = File.loadFile(url);
		if (event) {
			event.reply("readConfig_ack", reply);
		}
		return reply;
	}

	static saveConfig(event: any, res: any) {
		const data = JSON.parse(res);
		// @ts-ignore
		const url = path.join(configStatic, "config.json");
		File.saveFile(url, data);
	}

	static readSuperChatConfig(event: any) {
		// @ts-ignore
		const url = path.join(configStatic, "superchat.json");
		try {
			fs.accessSync(url);
			event.reply("readSuperChatConfig_ack", File.loadFile(url));
		} catch (error) {
			// @ts-ignore
			event.reply("readSuperChatConfig_ack", "#error");
		}
	}

	static saveSuperChatConfig(event: any, res: any) {
		const data = JSON.parse(res);
		// @ts-ignore
		const url = path.join(configStatic, "superchat.json");
		File.saveFile(url, data);
	}

	static loadPath(event: any, res: any) {
		let { url } = JSON.parse(res);
		if (!path.isAbsolute(url)) {
			url = path.join(process.resourcesPath, url);
		}
		event.reply("load_ack", File.loadFile(url));
	}

	static savePath(event: any, res: any) {
		let { url, data } = JSON.parse(res);
		if (!path.isAbsolute(url)) {
			url = path.join(process.resourcesPath, url);
		}
		File.saveFile(url, data);
	}

	static loadLegacyAppletSettings(event: any, res: any) {
		const { name } = JSON.parse(res);
		event.reply(
			"legacyApplet_loadSettings_ack",
			File.loadFile(path.join(configStatic, `${name}.json`))
		);
	}

	static saveLegacyAppletSettings(event: any, res: any) {
		const { name, data } = JSON.parse(res);
		File.savePath(
			{},
			JSON.stringify({
				url: path.join(configStatic, `${name}.json`),
				data,
			})
		);
	}

	static getFileList(event: any, res: any) {
		let { url } = JSON.parse(res);
		if (!path.isAbsolute(url)) {
			url = path.join(configStatic, url);
		}
		if (!url || !fs.existsSync(url)) {
			if (event.reply) {
				event.reply("get_file_list_ack", JSON.stringify([]));
			}

			return [];
		}
		const files = fs.readdirSync(url);
		if (event.reply) {
			event.reply("get_file_list_ack", JSON.stringify(files));
		}
		return files;
	}

	static getVoiceList(event: any) {
		const result: any = [
			...File.getFileList(
				{},
				JSON.stringify({
					url: path.join(configStatic, "/voices"),
				})
			).map((file: any) => {
				return {
					label: path.parse(file).name,
					value: `/configFiles/voices/${path.basename(file)}`,
				};
			}),
		];
		event.reply(
			"getVoiceList_ack",
			JSON.stringify({
				list: result,
			})
		);
	}

	static getFontList(event: any) {
		const result: any = [
			// @ts-ignore
			...File.getFileList(
				{},
				JSON.stringify({
					url: path.join(process.env.VITE_PUBLIC, "/fonts"),
				})
			).map((file: any) => {
				return {
					label: path.parse(file).name,
					value: `/fonts/${path.basename(file)}`,
				};
			}),
			...File.getFileList(
				{},
				JSON.stringify({
					url: path.join(configStatic, "/fonts"),
				})
			).map((file: any) => {
				return {
					label: path.parse(file).name,
					value: `/configFiles/fonts/${path.basename(file)}`,
				};
			}),
		];
		event.reply(
			"getFontList_ack",
			JSON.stringify({
				list: result,
			})
		);
	}

	static getCacheSize(event: any) {
		const fileList = File.walkDir(configStatic);
		let size = 0;
		fileList.forEach((file: any) => {
			size += fs.lstatSync(file).size;
		});
		event.reply("getCacheSize_ack", String(size));
	}
	static walkDir(filePath: string): Array<any> {
		const output: Array<any> = [];
		const fileList = fs.readdirSync(filePath);
		fileList.forEach((filename: string) => {
			const nFilePath = path.join(filePath, filename);
			if (fs.lstatSync(nFilePath).isFile()) {
				output.push(nFilePath);
			} else {
				output.push(...File.walkDir(nFilePath));
			}
		});
		return output;
	}
	static removeCache(event: any, args: any) {
		const folder = ["fonts", "images"];
		const allFiles: any = [];
		folder.forEach((folder) => {
			allFiles.push(...File.walkDir(path.join(configStatic, folder)));
		});
		const whiteList = ["config.json", "superchat.json", "applets.json"];
		const neededFiles: any = uniq(
			JSON.parse(args).map((p: string) => {
				return path.basename(p);
			})
		);
		whiteList.push(...neededFiles);
		allFiles.forEach((filePath) => {
			const basename = path.basename(filePath);
			if (whiteList.includes(basename)) return;
			fs.unlinkSync(filePath);
		});
		event.reply("removeCache_ack");
	}
	static openFolder(event: any, res: any) {
		let { url, create, home } = JSON.parse(res);

		if (home && !path.isAbsolute(url)) {
			url = path.join(require("os").homedir(), url);
		}
		if (!path.isAbsolute(url)) {
			url = path.join(configStatic, url);
		}
		if (create) {
			fs.mkdirSync(url, { recursive: true });
		}
		if (!url || !fs.existsSync(url)) {
			return;
		}
		const openExplorer = require("open-file-explorer");
		openExplorer(url);
	}
	static openCacheFolder() {
		File.openFolder({}, JSON.stringify({ url: "./", home: true }));
	}
}
export default File;
