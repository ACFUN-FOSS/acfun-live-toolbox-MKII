import { defineAsyncComponent, markRaw } from "vue";
import { basename } from "@front/util_function/base";

const requireComponent = import.meta.glob("@front/components/superChat/backgrounds/*.vue");

const output: any = {};
const backgroundArray: any = [];
Object.keys(requireComponent).forEach((fileName) => {
	const component = requireComponent[fileName];
	const value = basename(fileName).replace(".vue", "");
	backgroundArray.push({
		label: fileName,
		value,
	});
	output[value] = {
		label: fileName,
		value,
		component: markRaw(defineAsyncComponent(() => import(`@front/components/superChat/backgrounds/${value}.vue`))),
	};
});
export default output;
export { backgroundArray };
