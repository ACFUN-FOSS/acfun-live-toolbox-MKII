import { Store } from "vuex";
// @ts-ignore
import SharedWorker from "./shared.worker.js?worker";
let _worker: any = null;

export const openWorker = () => {
	if (_worker) {
		// @ts-ignore
		closeWorker();
	}
	_worker = new SharedWorker();
	window.addEventListener("beforeunload", () => {
		_worker.postMessage(["close"]);
	});
	return _worker;
};

// TODO: REFACTOR: 函数的逻辑和名字的关系好像很难被别人理解。重新命名函数或编写注释。
// 函数看起来不仅仅是注册了一个数据提供者，还注册了一个函数用于响应 sendUp 消息。
// 函数的意图是什么？
// 若找不到合适的描述方法，将其职责分割为多个函数中。

// 该函数可能是用于注册 SharedWorker 中数据的提供方的，同时也注册了一个 ”sendUp“ 的 callback。
// - 监听 sharedworker 的 ”requestData“ 消息，若收到则把 store 回传。
// - 监听 sharedworker 的 ”sendUp“ 消息，若收到则携带消息的 attrs 调用 dataCallback。
export const registerHost = (store: Store<any>, dataCallback: any = null) => {
	const worker = openWorker();
	worker.postMessage(["registerHost"]);

	worker.onmessage = (e: any) => {
		const [msg, ...attrs] = e.data;

		if (msg === "requestData") {
			const [id, ...states] = attrs;
			const output: any = {};
			states.forEach((state: string) => {
				output[state] = store.state[state];
			});
			worker.postMessage(["responseData", id, JSON.stringify(output)]);
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
	worker.postMessage(["registerClient", ...requireArray]);
	worker.onmessage = (e: any) => {
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
	_worker.postMessage(["close"]);
	_worker.close();
	_worker = null;
};
