import { randomId } from "@front/util_function/base";
import { defineAsyncComponent, markRaw } from "vue";

const requireComponent = import.meta.glob("@front/components/danmakuFlow/widgets/*.vue");

const output: any = {};
Object.keys(requireComponent).forEach((fileName: any) => {
	output[fileName] = {
		id: randomId(6),
		label: fileName,
		labelEn: fileName,
		widgetOptions: {},
		component: requireComponent[fileName],
		styleForm: {},
		styleValue: {},
	};
});
export default output;
