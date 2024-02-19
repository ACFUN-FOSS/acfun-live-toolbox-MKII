<!-- 

TODO: REFACTOR: 重整 views 文件夹里的目录结构，如下面所示：
views
  - electronViews			// 在 electron 窗口里显示的页面 components
    - xxxxxx
  - obsViews				// 在各种推流软件的浏览器源里显示的页面 components
    - xxxxxx

-->

<template>
	<content-frame id="general" align="row">
		<el-form label-width="130px" label-position="left">
			<el-form-item label="使用说明">
				<el-button @click="openDocuments" type="primary">点击打开</el-button>
			</el-form-item>
			<el-form-item label="系统">
				<el-button type="primary" @click="openConsole">打开控制台</el-button>
			</el-form-item>
			<el-form-item label="同步启动推流工具">
				<row-span :span="12"> <el-switch v-model="general.streamToolEnable" @change="save" /></row-span>
				<span class="hint">设置后工具箱启动时会同步打开推流工具(OBS或是直播助手)</span>
			</el-form-item>
			<el-form-item label="推流工具路径">
				<row-span :span="8">
					<el-input :model-value="general.streamToolPath" :disabled="general.streamToolEnable">
						<template #append>
							<el-button type="primary" class="attach" :disabled="general.streamToolEnable" @click="loadStreamToolPath">点击选择 </el-button>
						</template>
					</el-input>
				</row-span>
			</el-form-item>
			<el-form-item label="设置端口">
				<row-span :span="4">
					<el-input type="number" v-model="general.port" @change="save" class="general-number-input">
						<template #prepend>
							<span>服务器端口</span>
						</template>
					</el-input>
				</row-span>
				<row-span :span="4">
					<el-input type="number" v-model="general.socket" @change="save" class="general-number-input">
						<template #prepend>
							<span>信令端口</span>
						</template>
					</el-input>
				</row-span>
				<row-span :span="12" class="hint">如果发现端口冲突可以更改数字尝试,重启生效</row-span>
			</el-form-item>
			<el-form-item label="配置文件">
				<el-button type="primary" @click="openFolder">打开文件夹</el-button>
				<el-button type="primary" @click="backup">配置备份</el-button>
				<el-button type="primary" @click="restore">配置还原</el-button>
				<row-span :span="12" class="hint">一般情况下不需要备份配置，除非重装系统</row-span>
			</el-form-item>
			<el-form-item label="配置缓存">
				<el-button type="primary" @click="clean" disabled>清理配置缓存</el-button>
				<span class="cache-text"
					>当前配置缓存:<span>{{ cacheSizeUnit }}</span></span
				>
				<row-span :span="12" class="hint">点击清理配置文件夹中不用的图片与文件</row-span>
			</el-form-item>
			<el-form-item label="账号缓存">
				<el-button type="primary" @click="clearStorage">清理账号缓存</el-button>
				<row-span :span="12" class="hint">房间管理里的设置无法保存或出现混乱时试试清理账号缓存</row-span>
			</el-form-item>
		</el-form>
	</content-frame>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { generalSettings } from "@front/datas/aboutDanmaku";
import { mapState } from "vuex";
import { load } from "@front/util_function/file";
import { saveConfig, restoreConfig, backupConfig, getCacheSize, removeCache, openCacheFolder, openFolder, openConsole } from "@front/util_function/system";
import cloneDeep from "lodash/cloneDeep";
import { ElMessage } from "element-plus";
import { danmaku } from "@front/datas";
import { assign } from "@front/util_function/base";
import { byteFormatter } from "@front/util_function/formatter";
import { walk } from "@front/util_function/object";
import path from "path";
import uniq from "lodash/uniq";
export default defineComponent({
	name: "general",
	data() {
		return {
			general: {
				streamToolEnable: false,
				streamToolPath: ""
			},

			cacheSize: 0
		};
	},
	mounted() {
		this.loadConfig();
		this.getCacheSize();
	},
	computed: {
		...mapState(["danmakuProfile"]),
		cacheSizeUnit() {
			const cacheSize: any = this.cacheSize;
			return byteFormatter(cacheSize);
		}
	},
	methods: {
		openConsole,
		openDocuments() {
			openFolder(path.join(process.resourcesPath, "../使用说明"));
		},
		loadConfig() {
			this.general = cloneDeep(this.danmakuProfile.general) || generalSettings();
		},
		loadStreamToolPath() {
			load(".exe").then((res: any) => {
				this.general.streamToolPath = res.path;
				this.save();
			});
		},
		save() {
			Object.assign(this.danmakuProfile, {
				general: cloneDeep(this.general)
			});
			saveConfig(this.danmakuProfile);
			ElMessage({
				duration: 1500,
				message: "保存成功",
				offset: 60,
				type: "success"
			});
		},
		clearStorage() {
			localStorage.clear();
			ElMessage({
				type: "success",
				message: "清理缓存成功！",
				duration: 1500,
				offset: 60
			});
		},
		async restore() {
			const file: any = await load(".zip");
			const config = await restoreConfig(file.path);
			if (config) {
				this.$store.state.danmakuProfile = assign(danmaku.profile(), config);
				this.loadConfig();
				this.$store.commit("updateSettings", {});
				ElMessage({
					type: "success",
					message: "配置还原成功！",
					duration: 1500,
					offset: 60
				});
			} else {
				ElMessage({
					type: "error",
					message: "配置还原失败",
					duration: 1500,
					offset: 60
				});
			}
		},
		backup() {
			backupConfig()
				.then((url: any) => {
					window.open(url);
				})
				.catch((err) => {
					console.error(err);
				});
		},
		getCacheSize() {
			getCacheSize().then((res: any) => {
				this.cacheSize = parseInt(res);
			});
		},
		clean() {
			const keepList = walk(this.$store.state.danmakuProfile, (value: any) => {
				try {
					return path.extname(value);
				} catch (error) {
					return false;
				}
			});
			removeCache(uniq(keepList)).then((res) => {
				this.getCacheSize();
			});
		},
		openFolder() {
			openCacheFolder();
		}
	}
});
</script>

<style scoped lang="scss">
@use "sass:map";
@import "@front/styles/common.scss";
#general {
	position: absolute;
	width: 100%;
	height: 100%;
	overflow-y: auto;
	.general-number-input {
		min-width: 200px;
	}
	.cache-text {
		margin-left: 10px;
		& > span {
			color: red;
		}
	}
	.el-form-item{
		margin-bottom: 10px !important;
	}
}
</style>
