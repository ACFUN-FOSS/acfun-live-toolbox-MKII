/**
 * FILENAME: wsbus.ts
 * 
 * DESC: 负责不同工具箱的实例（工具箱 electron 窗口、浏览器弹幕视图等）之间的通信。
 */
import { Event } from "@front/util_function/eventBus";
import { io, Socket } from "socket.io-client";

// TODO: REFACTOR: 名称不当。本类看起来更像是代表了一个通信的总线，而不是 Event。
class WsEvent extends Event {
	registered = false;
	io: Socket | undefined;
	id = "";
	socket = 4396;
	constructor() {
		super();
		this.id = "";
	}

	register(id: string, socket = 4396) {
		this.id = id;
		if (!this.checkRegister()) {
			this.io = io(`http://${window.location.hostname}:${socket}`, {
				transports: ["websocket", "polling"],
				query: {
					id
				}
			});

			this.io.on("connect", () => {
				this.registered = true;
				this.id = id;
				this.socket = socket;
				this.emit("registered");
			});
			this.io.on("transmit", (data: any) => {
				const realData = JSON.parse(data);
				this.emit(realData.event, realData.data);
			});
			const close = () => {
				this.registered = false;
				this.io = undefined;
			};
			this.io.on("reconnect_failed", close);
			this.io.on("reconnect_error", close);
			this.io.on("reconnect_attempt", num => {
				if (num > 10) {
					this.io?.close();
					close();
					this.register(this.id, this.socket || 4396);
				}
			});
		}
		return Promise.resolve();
	}

	checkRegister() {
		if (!this.io) return false;
		return !this.io.disconnected;
	}

	wsEmit(event: any, data: any = {}, to = "") {
		if (!this.io) return;
		this.io.emit(
			"transmit",
			JSON.stringify({
				event,
				from: this.id,
				to,
				data
			})
		);
	}
}

export const wsevent = new WsEvent();
