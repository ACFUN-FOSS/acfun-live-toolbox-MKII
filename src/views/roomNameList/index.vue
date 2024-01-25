<template>
	<content-frame id="roomNameList" v-loading="loading">
		<el-row :gutter="20">
			<el-col :span="12">
				<div class="room-name-list-title">怪人（黑名单）</div>
				<el-input style="margin-bottom: 5px" v-model="blackListToAdd" placeholder="点击输入UID,回车添加" @keypress.enter="addBlackList" />
				<base-list style="width: 100%; height: 180px" :list="blackList" :action="blackListAction()" />
			</el-col>
			<el-col :span="12">
				<div class="room-name-list-title">屏蔽关键词</div>
				<el-input
					style="margin-bottom: 5px"
					v-model="keywordToAdd"
					placeholder="点击输入关键词,回车添加"
					@keypress.enter="
						$store.commit('addKeyword', keywordToAdd);
						keywordToAdd = '';
					"
				/>
				<base-list style="width: 100%; height: 180px" :list="keywordList" :action="keywordAction()" />
			</el-col>

			<el-col :span="12">
				<div class="room-name-list-title">房管</div>
				<el-input style="margin-bottom: 5px" v-model="managerToAdd" placeholder="点击输入UID,回车添加" @keypress.enter="addManager" />
				<base-list style="width: 100%; height: 180px" :list="managerL1st" :action="managerAction()" />
			</el-col>
			<el-col :span="12">
				<div class="room-name-list-title">特别关心（暂时不可用）</div>
				<el-input style="margin-bottom: 5px" v-model="likeListToAdd" placeholder="点击输入UID,回车添加" @keypress.enter="addLikeList" />
				<base-list style="width: 100%; height: 160px" :list="likeList" :action="likeListAction()" />
				<span class="hint">特别关心：设置以后该用户首次进入直播间将会提醒</span>
			</el-col>
		</el-row>
	</content-frame>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { mapState } from "vuex";
import { streamInfo } from "@front/api/user";
import baseList from "@front/components/base/list/baseList.vue";
import { ElMessage } from "element-plus";
export default defineComponent({
	name: "roomNameList",
	components: { baseList },
	data() {
		return {
			keywordToAdd: "",
			blackListToAdd: "",
			managerToAdd: "",
			likeListToAdd: "",
			loading: false
		};
	},
	mounted() {
		this.$store.commit("getManagerList");
	},
	computed: {
		...mapState(["danmakuProfile", "managerList", "userProfile"]),
		blackList(): Array<any> {
			return this.danmakuProfile.common.blackList.map((i: any) => {
				return {
					label: i.nickname,
					...i
				};
			});
		},
		likeList(): Array<any> {
			try {
				return this.danmakuProfile.common.likeList.map((i: any) => {
					return {
						label: i.nickname,
						...i
					};
				});
			} catch (error) {
				console.error(error);
				return [];
			}
		},
		keywordList(): Array<any> {
			return this.danmakuProfile.common.keywords.map((i: any) => {
				return {
					label: i
				};
			});
		},
		managerL1st(): Array<any> {
			return this.managerList.map((manager: any) => {
				return {
					label: manager.userInfo.nickname,
					...manager.userInfo
				};
			});
		}
	},
	methods: {
		blackListAction() {
			return [
				{
					icon: "el-icon-delete",
					action: (e: any) => {
						this.$store.commit("removeBlackList", e);
					}
				}
			];
		},
		likeListAction() {
			return [
				{
					icon: "el-icon-delete",
					action: (e: any) => {
						this.$store.commit("removeLikeList", e);
					}
				}
			];
		},
		keywordAction() {
			return [
				{
					icon: "el-icon-delete",
					action: (e: any) => {
						this.$store.commit("removeKeyword", e.label);
					}
				}
			];
		},
		managerAction() {
			return [
				{
					icon: "el-icon-delete",
					action: (e: any) => {
						this.$store.commit("removeManager", e.userID);
					}
				}
			];
		},
		addManager() {
			this.getUserInfo(this.managerToAdd, this.managerL1st, 10).then((userInfo) => {
				if (userInfo) {
					this.$store.commit("addManager", userInfo.userID);
					this.managerToAdd = "";
				}
			});
		},
		addBlackList() {
			this.getUserInfo(this.blackListToAdd, this.blackList).then((userInfo) => {
				if (userInfo) {
					this.$store.commit("addBlackList", userInfo);
					this.blackListToAdd = "";
				}
			});
		},
		addLikeList() {
			this.getUserInfo(this.likeListToAdd, this.likeList).then((userInfo) => {
				if (userInfo) {
					this.$store.commit("addLikeList", userInfo);
					this.likeListToAdd = "";
				}
			});
		},
		async getUserInfo(value: any, list: Array<any>, max = -1) {
			if (!value) {
				return false;
			}
			const uid = parseInt(value);
			let errorMsg = "";
			let userInfo: any = {};
			let found = null;
			this.loading = true;
			if (isNaN(uid)) {
				errorMsg = "错误：只能输入用户数字uid";
			} else if (max > 0 && list.length === max) {
				errorMsg = "错误：添加数量达到最大";
			} else if (uid === this.userProfile.userID) {
				errorMsg = "错误：恁别把自己加进去";
			} else if ((found = list.find((i) => i.userID === uid))) {
				errorMsg = `错误：用户已在列表中，名字是${found.nickname}`;
			} else {
				try {
					if (
						!(userInfo = (
							await streamInfo({
								userID: uid
							})
						).profile)
					) {
						throw new Error();
					}
				} catch (error) {
					console.error(error);
					errorMsg = "错误：找不到该用户";
				}
			}
			this.loading = false;
			if (errorMsg) {
				ElMessage({
					offset: 60,
					type: "error",
					message: errorMsg,
					duration: 1500
				});
				return false;
			}
			return {
				userID: userInfo.userID,
				nickname: userInfo.nickname
			};
		}
	}
});
</script>

<style scoped lang="scss">
@use "sass:map";
@import "@front/styles/scrollbar.scss";
#roomNameList {
	position: absolute;
	width: 100%;
	height: 100%;
	flex-wrap: wrap;
	overflow: auto;
	@include scrollbarDark();
	.room-name-list-title {
		position: relative;
		font-weight: 700;
		color: getCssVar("text-color", "primary");
		height: 24px;
		user-select: none;
	}
}
</style>
