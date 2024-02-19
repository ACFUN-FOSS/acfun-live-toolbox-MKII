/**
 * FILENAME: socket.ts
 * 
 * DESC: 在不同工具箱实例之间（各个 electron 窗口、浏览器打开的弹幕视图……）
 * 通讯的 ws 服务器的启动、查看端口占用等操作。
 */

import { Server } from "socket.io";
import ip from "ip";
import { port, socket } from "./http";

const clients = {};
const isPortFree = (port) =>
	new Promise((resolve) => {
		const server = require("http")
			.createServer()
			.listen(port, () => {
				server.close();
				resolve(true);
			})
			.on("error", () => {
				resolve(false);
			});
	});

const startSocket = async (server) => {
	if (!(await isPortFree(socket || 4396))) return;
	const httpServe = require("http").createServer(server);
	const address = ip.address();
	const io = new Server(httpServe, {
		cors: {
			origin: [`http://${address}:${port || 1299}`, `http://${address}:8080`, `http://${address}:8081`],
		},
		transports: ["websocket", "polling"],
		pingInterval: 1000,
		pingTimeout: 1000 * 60,
		agent: false,
		rejectUnauthorized: false,
	});

	io.on("connection", (socketI) => {
		const { handshake } = socketI;
		if (!handshake || !handshake.query.id) return;
		const id = handshake.query.id;
		if (clients[id]) clients[id].disconnect(true);
		clients[id] = socketI;

		// socket.on("disconnect", () => {
		// 	delete clients.id;
		// });

		socketI.on("transmit", (message) => {
			const { to } = JSON.parse(message);
			if (to && clients[to]) {
				clients[to].emit("transmit", message);
			}
		});
	});
	httpServe.listen(socket || 4396, () => {
		console.log("socket opened!");
	});
};

export { startSocket };
