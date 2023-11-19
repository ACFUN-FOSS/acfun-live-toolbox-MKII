import { App } from "vue";
export const initGlobalComp = (vm: App) => {
	const requireComponent = import.meta.glob("@front/components/base/*.vue");
	Object.keys(requireComponent).forEach((fileName: any) => {
		vm.component(fileName);
	});
};
