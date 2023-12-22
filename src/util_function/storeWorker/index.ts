import { Store } from "vuex";
// @ts-ignore
import SharedWorker from "./shared.worker.js?sharedworker";

// TODO: REFACTOR: 重构为 `getWorker`
let _worker: any = null;

export const openWorker = () => {
	if (_worker) {
		// @ts-ignore
		closeWorker();
	}
	_worker = new SharedWorker();
	_worker.port.start();
	window.addEventListener("beforeunload", () => {
		_worker.port.postMessage(["close"]);
	});
	return _worker;
};

// TODO: REFACTOR: 函数好像不易被别人一下子理解。编写注释。

// 应该是主窗口被称为 “Host”，而其他实例被称作 “client”。
// 本函数的作用可能是：注册主窗口的状态信息，以叫 SharedWorker 能在 clients 请求的时候发送自己的状态信息。
//   - 广播 “registerHost” 消息，通知其他工具箱实例，传递主窗口进程的 port。响应方为 shared.worker.js 中的 `onconnect`。
//   - 注册一个 SharedWorker 中数据的提供方。监听 SharedWorker 的 ”requestData“ 消息，若收到则把 store 回传。
export const registerHost = (store: Store<any>, dataCallback: any = null) => {
	const worker = openWorker();
	worker.port.postMessage(["registerHost"]);

	worker.port.onmessage = (e: any) => {
		const [msg, ...attrs] = e.data;

		if (msg === "requestData") {
			const [id, ...states] = attrs;
			const output: any = {};
			states.forEach((state: string) => {
				output[state] = store.state[state];
			});
			worker.port.postMessage(["responseData", id, JSON.stringify(output)]);
		}
		// TODO: REFACTOR: 看起来 sendUp 仅仅在 shared.worker.js 被使用，作用是
		// 通知 host 所有的 client 已经完成发送 requestData 信息。
		if (msg === "sendUp") {
			if (dataCallback instanceof Function) dataCallback(msg, attrs);
		}
	};
};

// 该函数可能是用于注册 SharedWorker 中数据的接收方的。
// 监听 sharedworker 的 ”response“ 消息，若收到则携带消息的 data 调用 callback。
export const registerClient = (requireArray: Array<any>, callback: any) => {
	const worker = openWorker();
	worker.port.postMessage(["registerClient", ...requireArray]);
	worker.port.onmessage = (e: any) => {
		const [msg, data] = e.data;
		if (msg === "response") {
			callback(JSON.parse(data));
		}
	};
};

export const closeWorker = () => {
	if (!_worker) {
		return;
	}
	_worker.port.postMessage(["close"]);
	_worker.port.close();
	_worker = null;
};
