import { App, defineAsyncComponent } from "vue";
export const initGlobalComp = (vm: App) => {
	const requireComponent = import.meta.glob("@front/components/base/**/*.vue");
	for (const [path, component] of Object.entries(requireComponent)) {
		vm.component(path.substring(path.lastIndexOf("/") + 1, path.lastIndexOf(".")), defineAsyncComponent(component));
	}
};
