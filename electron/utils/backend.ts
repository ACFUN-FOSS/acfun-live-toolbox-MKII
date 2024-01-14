import nodeSession from "./gcBackend/node";
import { v4 as uuidv4 } from "uuid";
import {} from "express";
let session = null;
let danmakuFlows = {};
let online = false;

const setResJson = (res) => {
	res.setHeader("Content-Type", "text/json");
	res.setHeader("Cache-Control", "no-cache");
	res.flushHeaders();
};
const setResSSE = (res) => {
	res.setHeader("Content-Type", "text/event-stream");
	res.setHeader("Cache-Control", "no-cache");
	res.setHeader("Connection", "keep-alive");
	res.flushHeaders();
};

class Backend {
	static init() {
		this.closeDanmaku();
		danmakuFlows = {};
		online = false;
		session = nodeSession();
		session.connect();
		session.on("websocketOpen", () => (online = true));
	}

	static addClient(uid, client) {
		if (!danmakuFlows[uid]) danmakuFlows[uid] = new Map();
		danmakuFlows[uid].set(uuidv4(), client);
	}

	static handleRequest({ method, params }) {
		return session.asyncRequest(method, params);
	}

	static getDanmaku(uid) {
		//ToDo 用Event_Stream 实现弹幕获取，需要考虑多房间弹幕的情况
		session.on(
			"comment",
			({ data }) => {
				this.saveDanmaku(data);
				danmakuFlows[uid].forEach((client) => {
					client.wirte(data);
				});
			},
			uid
		);
	}

	static saveDanmaku(danmaku) {
		//ToDo sqlite
	}

	static closeDanmaku() {
		//ToDo 服务端重启 应该没有会用到的地方
		Object.values(danmakuFlows).forEach((danmakuFlow: Map<any, any>) => {
			danmakuFlow.forEach((client) => {
				client.wirte(`{ code: 999 }`);
			});
		});
	}
}

export const startBackend = (app) => {
	Backend.init();

	app.get("/online", (req, res) => {
		setResJson(res);
		res.json({ online });
	});

	app.post("/api", (req, res) => {
		setResJson(res);
		if (!req.body?.method) {
			res.json("Request Failed!");
			return;
		}
		Backend.handleRequest(req.body)
			.then((revl) => {
				res.json(revl);
			})
			.catch((e) => {
				res.json(e);
			});
	});
};

export default Backend;
export { session };
