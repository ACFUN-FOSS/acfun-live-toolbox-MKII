// TODO: REFACTOR: Rename `test` folder with a word like `testPage`.

import main from "@front/layouts/main/index.vue";
import { RouteRecordRaw } from "vue-router";

let output: RouteRecordRaw[] = [];

if (process.env.NODE_ENV !== "production") {
	const children: Array<any> = [];
	const requireComponent = import.meta.glob("./*.vue");
	Object.keys(requireComponent).forEach((fileName) => {
		const name = fileName.replaceAll(".", "");
		children.push({
			path: `/testEnv${name}`,
			name,
			component: requireComponent[fileName],
			meta: {
				label: name,
				action: "router",
			},
		});
	});
	output = [
		{
			path: "/testEnv",
			name: "testEnv",
			component: main,
			meta: {
				label: "测试组件",
			},
			children,
		},
	];
}

export default output;
