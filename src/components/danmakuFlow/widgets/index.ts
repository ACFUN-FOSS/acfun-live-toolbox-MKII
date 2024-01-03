import { randomId } from "@front/util_function/base";
import { defineAsyncComponent, markRaw } from "vue";

const requireComponent: { [T: string]: () => Promise<any> } = import.meta.glob("@front/components/danmakuFlow/widgets/*/index.vue");

//const output: any = {};
//debugger;

function retrieve2ndDirFromPath(path: string) {
	const pathArr = path.split("/");
	return pathArr[pathArr.length - 2];
}

// TODO: REFACTOR: 为什么要返回这样的结构？
// 为了给 danmakuSettings 提供设置。
// Object.keys(requireComponent).forEach( (fileName: any) => {
// 	//debugger;
// 	const labelEn = retrieve2ndDirFromPath(fileName);
// 	output[labelEn] = {
// 		id: randomId(6),
// 		label: labelEn,
// 		labelEn: labelEn,
// 		widgetOptions: {},
// 		component: requireComponent[fileName],
// 		styleForm: {},
// 		styleValue: {},
// 	};
// });

//export default output;

// TODO: REFACTOR: 用接口定义每个 widgetsSetting 的数据结构。
export const widgetsSettings:{ [key: string]: any } = {};
for(const vueFilePath in requireComponent) {
	const labelEn = retrieve2ndDirFromPath(vueFilePath);
	widgetsSettings[labelEn] = {
		id: randomId(6),
		label: labelEn,
		labelEn: labelEn,
		widgetOptions: {},
		component: requireComponent[vueFilePath],
		styleForm: {},
		styleValue: {},
	};
}



export let allDanmakuWidgets: { [key: string]: () => Promise<unknown> } = {};
for(const vueFilePath in requireComponent) {
	//const console.log(await requireComponent[vueFilePath]());
	//console.log(await import(vueFilePath));
	const labelEn = retrieve2ndDirFromPath(vueFilePath);
	allDanmakuWidgets[labelEn] = defineAsyncComponent(requireComponent[vueFilePath]);
}



//debugger;

