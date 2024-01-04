import { App } from "vue";
export const initGlobalComp = (vm: App) => {
	const requireComponent = import.meta.glob("@front/components/base/*.vue");
	for (let fileName in requireComponent) {
		vm.component(fileName, requireComponent[fileName]);
	}
};
