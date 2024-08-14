// TODO: REFACTOR: 将所有本文件中的 Http 字眼重命名为 HttpServer

import path from "path";
import his from "connect-history-api-fallback";
import ip from "ip";
import express from "express";
import routes from "./routes";

const renderProcessDistDir = process.env.DIST;

// TODO: REFACTOR: Rename to `httpServerPort`.
export const port = 1299;

export const server = express();

export const startHttp = () => {
	return new Promise((resolve) => {
		server.use(express.json());
		server.use((req: any, res: any, next: any) => {
			res.header(
				"Cache-Control",
				"private, no-cache, no-store, must-revalidate"
			);
			res.header("Expires", "-1");
			res.header("Pragma", "no-cache");
			next();
		});
		server.use(
			his({
				disableDotRule: false,
				verbose: true,
				rewrites: [
					{
						from: /\/api/,
						to: (c) => c.parsedUrl.pathname,
					},
				],
			})
		);

		// server.use("/api/backend", routes.backendRequest);
		// server.use("/api/danmaku", routes.backendDanmaku);
		server.use("/api/messagers", routes.messagers);
		// server.use("/api/toolbox", routes.toolbox);

		// 处理访问 /obs/danmaku/assets/index-xxx.js 和 /obs/danmaku/assets/index-xxx.css
		// URL 时候的回应。
		// When visit http://xxxxx/obs/danmaku/ in an external browser, the browser will try to load
		// http://xxxxx/obs/danmaku/assets/index-xxx.js and
		// http://xxxxx/obs/danmaku/assets/index-xxx.css, due to vite will inject
		// <script type="module" crossorigin src="./assets/index-xxx.js"></script>
		// <link rel="stylesheet" href="./assets/index-xxx.css">
		// to the index.html.
		server.get("/", function (req: any, res: any) {
			res.render(path.join(renderProcessDistDir, "index.html"));
		});

		server.listen(port, function () {
			resolve({ url: `http://${ip.address()}:${port}`, server });
		});
	});
};
