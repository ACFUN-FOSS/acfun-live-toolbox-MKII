import component from "*.vue";
import main from "@front/layouts/main/index.vue";
let output: Array<any> = [];
if (process.env.NODE_ENV !== "production") {
	const children: Array<any> = [];
	const requireComponent = import.meta.glob("./*.vue");
	Object.keys(requireComponent).forEach((fileName) => {
		const name = fileName;
		children.push({
			path: `/${fileName}`,
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
