/**
 * FILENAME: http.ts
 * 
 * DESC: 启动 HTTP（用于 serve 静态文件）与 ws（用于工具箱不同实例通讯）服务器。
 */

import { appStatic, configStatic } from "./paths";
import { startSocket } from "./socket";
import File from "./file";


import path from "path";
import his from "connect-history-api-fallback";
import ip from "ip";
import express from "express";
import { isRunningInDevServer } from "./sys";

const settings = JSON.parse(File.loadConfig(null) || "{}");

// TODO: REFACTOR: Rename to `httpServerPort`.
export const port = settings && settings.general && settings.general.port ? settings.general.port : 1299;
// TODO: REFACTOR: Rename to `wsServerPort`.
export const socket = settings && settings.general && settings.general.socket ? settings.general.socket : 4396;

// 如果运行于 DEV SERVER，则一个哑巴 express 服务器，只用于给 socket.io
// 创建 ws 服务器使。
// 否则，启动完整的 express 服务器，同时用于 serve 静态文件。
export const startHttp = () => {
	return new Promise((resolve) => {
		const dirname = process.resourcesPath;

		const server = express();

		startSocket(server);
		server.use((req: any, res: any, next: any) => {
			res.header("Cache-Control", "private, no-cache, no-store, must-revalidate");
			res.header("Expires", "-1");
			res.header("Pragma", "no-cache");
			next();
		});

		if (!isRunningInDevServer()) {
			server.use(express.static(appStatic));
			server.use(
				"/configFiles",
				express.static(configStatic, {
					immutable: true,
				})
			);
			server.use(
				his({
					disableDotRule: true,
					verbose: true,
				})
			);
			server.use(express.static(appStatic));
			server.use(
				"/configFiles",
				express.static(configStatic, {
					immutable: true,
				})
			);
			server.get("/", function (req: any, res: any) {
				res.render(path.join(dirname, "/app/index.html"));
			});
		} else {
			server.get("/", (_, res) => {
				res.send(`Ws server is listening on ${socket}.`);
			});
		}

		server.listen(port, function () {
			resolve(`http://${ip.address()}:${port}`);
		});
	});
};
