const clients = {};

const eventsHandler = (req, res) => {
	const headers = {
		"Content-Type": "text/event-stream",
		Connection: "keep-alive",
		"Cache-Control": "no-cache",
	};
	res.writeHead(200, headers);

	const { isElectron, name } = req.query;
	console.log(`${name} try to register!`);
	if (!name) {
		res.write(toEventSource(`param error!`));
		res.end();
		return;
	}
	clients[name] = res;
	res.write(toEventSource(`Client ${name} registered!`));
	res.on("close", () => {
		console.log(`${name} Connection closed`);
		delete clients[name];
	});
};

export const register = eventsHandler;

export const emit = (req, res) => {
	const { source, target, event, data } = req.body;
	if (!clients[target]) {
		res.write(toEventSource(`Client ${target} no found.`));
		return;
	}
	clients[target].write(
		toEventSource({
			source,
			data,
			event,
		})
	);

	res.send(
		JSON.stringify({
			code: 200,
			msg: `${event} emit successful from ${source} to ${target} `,
		})
	);
};

const toEventSource = (data: String | Object) => {
	if (typeof data !== "string") {
		data = JSON.stringify(data);
	}
	return `data:  ${data}\n\n`;
};
