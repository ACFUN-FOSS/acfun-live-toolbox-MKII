import { isElectron } from "@front/util_function/electron";
import { removePunctuationSpace } from "@front/util_function/base";
import { copy as copyText } from "./clipboard";

// TODO: REFACTOR: move to electron.ts
// REFACTOR: 为必须使用 Electroon 的场合 提供一个 `requireElectron`
// 函数，检测到不是 Electron 就抛出异常，否则返回 Electron。
let ipcRenderer = await (async () => {
	if (isElectron()) return (await import("electron")).ipcRenderer;
	else return null;
})();

export const path = isElectron() ? window.require("path") : {};
export { ipcRenderer, copyText };

export const minimize = () => {
	if (isElectron()) {
		ipcRenderer?.send("win_minimize");
	}
};

export const openConsole = () => {
	if (isElectron()) {
		ipcRenderer?.send("win_openDevtools");
	}
};

export const getWinPos = (): Promise<number[]> => {
	return new Promise((resolve) => {
		if (isElectron()) {
			ipcRenderer?.send("win_getPos");
			ipcRenderer?.once("win_getPos_ack", (event, pos: number[]) => {
				resolve(pos);
			});
		} else {
			resolve([0, 0]);
		}
	});
};

export const setWinBounds = (bounds: Partial<Electron.Rectangle>) => {
	if (isElectron()) {
		ipcRenderer?.send("win_setBounds", bounds);
	}
};

export const startLegacyApplet = (appletConfig: any) => {
	if (isElectron()) {
		ipcRenderer?.send("legacyApplet_start", JSON.stringify(appletConfig));
	}
};

export const loadLegacyAppletSettings = (name: any) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("legacyApplet_loadSettings", JSON.stringify({ name }));
			ipcRenderer?.once("legacyApplet_loadSettings_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(JSON.parse(args));
				} else {
					throw new Error("legacyApplet_loadSettings failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const saveLegacyAppletSettings = (name: any, data: any) => {
	if (isElectron()) {
		ipcRenderer?.send("legacyApplet_saveSettings", JSON.stringify({ name, data }));
	}
};

export const legacyAppletList = () => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("legacyApplet_list");
			ipcRenderer?.once("legacyApplet_list_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(JSON.parse(args));
				} else {
					throw new Error("legacyApplet_list failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const close = () => {
	if (isElectron()) {
		ipcRenderer?.send("win_openDevtools");
	}
};
export const log = (msg: any) => {
	if (isElectron()) {
		ipcRenderer?.send("log", String(msg));
	}
};

export const setTop = (isTop: boolean) => {
	if (isElectron()) {
		ipcRenderer?.send(
			"mainwin_setTop",
			JSON.stringify({
				isTop,
			})
		);
	}
};

export const setIgnoreMouseEvent = (ignore: boolean) => {
	if (isElectron()) {
		ipcRenderer?.send(
			"mainwin_setIgnoreMouseEvent",
			JSON.stringify({
				ignore,
			})
		);
	}
};

export const setResizeable = (isResizeable: boolean) => {
	if (isElectron()) {
		ipcRenderer?.send(
			"mainwin_setResizeable",
			JSON.stringify({
				isResizeable,
			})
		);
	}
};

export const restore = () => {
	if (isElectron()) {
		ipcRenderer?.send("win_restore");
	}
};

export const backendKill = () => {
	if (isElectron()) {
		ipcRenderer?.send("backend_kill");
	}
};

export const backendRestart = () => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("backend_restart");
			ipcRenderer?.once("restart_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("restart failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const backendInit = () => {
	if (isElectron()) {
		ipcRenderer?.send("backend_init");
	}
};

export const launch = (path: any) => {
	if (!path) return;
	if (isElectron()) {
		ipcRenderer?.send("backend_launch", path);
	}
};

export const save = (data: any) => {
	if (isElectron()) {
		ipcRenderer?.send("backend_save", JSON.stringify(data));
	}
};

export const reload = () => {
	if (isElectron()) {
		ipcRenderer?.send("mainwin_reload");
	}
};

export const load = (data: any) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("backend_load", JSON.stringify(data));
			ipcRenderer?.once("load_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("load file failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const copy = ({ srcUrl, distUrl }: any) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send(
				"backend_copy",
				JSON.stringify({
					srcUrl,
					distUrl,
				})
			);
			ipcRenderer?.once("copy_file_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("copy file failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const uploadImage = (imageUrl: string) =>
	new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send(
				"copyFileWithMd5Name",
				JSON.stringify({
					srcUrl: imageUrl,
					distUrl: "./images",
				})
			);
			ipcRenderer?.once("copyFileWithMd5Name_ack", (e: any, res: any) => {
				if (res !== "#error") {
					resolve(res);
				} else {
					throw new Error("copyFileWithMd5Name failed!");
				}
			});
		} catch (e) {
			// console.log(e);
			reject(e);
		}

		// return copy({
		// 	srcUrl: imageUrl,
		// 	distUrl: `./images/image${randomId(12)}${path.extname(imageUrl)}`
		// });
	});

export const uploadBase64Image = (b64: string) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("saveB64ToImgFile", b64);
			ipcRenderer?.once("saveB64ToImgFile_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("load file failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const saveConfig = (data: any) => {
	if (!isElectron()) {
		throw new Error("no electron!");
	}
	ipcRenderer?.send("backend_save_config", JSON.stringify(data));
};

export const readConfig = () => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("readConfig");
			ipcRenderer?.once("readConfig_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(JSON.parse(args));
				} else {
					throw new Error("load file failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const restoreConfig = (path: string) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("restoreAndReadBackupConfig", path);
			ipcRenderer?.once("restoreAndReadBackupConfig_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(JSON.parse(args));
				} else {
					throw new Error("读取备份文件失败！");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};
export const backupConfig = () => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("backupConfig");
			ipcRenderer?.once("backupConfig_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("备份文件失败！");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const removeCache = (data: any = []) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("removeCache", JSON.stringify(data));
			ipcRenderer?.once("removeCache_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("删除缓存失败！");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const getCacheSize = () => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("getCacheSize");
			ipcRenderer?.once("getCacheSize_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("备份文件失败！");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const openFolder = (url: string, home = false) => {
	if (!isElectron()) {
		throw new Error("no electron!");
	}
	ipcRenderer?.send(
		"openFolder",
		JSON.stringify({ url, create: true, home })
	);
};

export const openFile = ({ url, create }: any) => {
	if (!isElectron()) {
		throw new Error("no electron!");
	}
	// console.log(url);
	ipcRenderer?.send("openFolder", JSON.stringify({ url, create }));
};

export const openCacheFolder = () => {
	if (!isElectron()) {
		throw new Error("no electron!");
	}
	ipcRenderer?.send("openCacheFolder");
};

export const saveSuperChatConfig = (data: any) => {
	if (!isElectron()) {
		throw new Error("no electron!");
	}
	ipcRenderer?.send("saveSuperChatConfig", JSON.stringify(data));
};

export const readSuperChatConfig = () => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("ReadSuperchatConfig");
			ipcRenderer?.once("ReadSuperchatConfig_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(JSON.parse(args));
				} else {
					throw new Error("load superchat config failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const getFontList = () => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("getFontList");
			ipcRenderer?.once("getFontList_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(JSON.parse(args));
				} else {
					throw new Error("get font list failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const getVoiceList = () => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("getVoiceList");
			ipcRenderer?.once("getVoiceList_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(JSON.parse(args));
				} else {
					throw new Error("load voice failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const uploadFont = (fontUrl: string) => {
	return copy({
		srcUrl: fontUrl,
		distUrl: `./fonts/${path.basename(fontUrl)}`,
	});
};

export const sendChat = (data: any) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send("send_chat", JSON.stringify(data));
			ipcRenderer?.once("send_chat_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("send chat failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const windowsRead = ({ speed, text, volume }: any) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send(
				"send_voice",
				JSON.stringify({
					volume,
					speed,
					text: removePunctuationSpace(text),
				})
			);
			ipcRenderer?.once("voice_ack", (e: any, args: any) => {
				if (args !== "#error") {
					resolve(args);
				} else {
					throw new Error("send chat failed!");
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const xfRead = ({ api, speed, text, volume }: any) => {
	return new Promise((resolve, reject) => {
		try {
			if (!isElectron()) {
				throw new Error("no electron!");
			}
			ipcRenderer?.send(
				"send_xfvoice",
				JSON.stringify({
					api,
					volume: 100,
					speed,
					text: removePunctuationSpace(text),
				})
			);
			const timeout = setTimeout(() => {
				reject(new Error("send chat failed!"));
			}, 5000);
			ipcRenderer?.once("xfvoice_ack", (e: any, args: any) => {
				clearTimeout(timeout);
				if (args !== "#error") {
					resolve(`${args}?cb=${Date.now()}`);
				} else {
					reject(new Error("send chat failed!"));
				}
			});
		} catch (error) {
			reject(error);
		}
	});
};

export const urlRead = ({ url, volume }: any) => {
	return new Promise((resolve, reject) => {
		const audio = new Audio();
		audio.onerror = reject;
		audio.onended = resolve;
		audio.volume = volume / 100;
		audio.src = `${url}?cb=${Date.now()}`;
		audio.play();
	});
};

export const robots = {
	default: windowsRead,
	kdxf: xfRead,
	urlRead,
};
