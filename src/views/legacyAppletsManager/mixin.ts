import { defineComponent } from "vue";
import {
	startLegacyApplet,
	legacyAppletList,
	openFolder,
	openFile,
} from "@front/util_function/system";
import path from "path";
export default defineComponent({
	data() {
		return {
			applets: [],
		};
	},
	mounted() {
		this.refreshList();
	},
	methods: {
		startApplet: startLegacyApplet,
		refreshList() {
			legacyAppletList().then((res) => {
				(this.applets as any) = res;
			});
		},
		openFolder() {
			openFolder("./legacyApplets");
		},
		openDocument() {
			openFile({
				url: path.join(
					process.resourcesPath,
					"../使用说明/小程序二次开发文档.md"
				),
			});
		},
	},
});
