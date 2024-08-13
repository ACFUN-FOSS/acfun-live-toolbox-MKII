# AcFun Live ToolBox

<div align="center">
  <img src="./工具箱构架说明.svg" height="450px">
</div>
<div align="center">
  <span><img src="./readme_acfunlogo.svg" height="50px"></span>
  &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; 
  &nbsp; &nbsp; &nbsp; 
  <span><img src="./readme_agpllogo1.png" height="50px"></span>
</div>
<div align="center">

  *An AcFun-FOSS project.*
</div>

## Prerequisite

-   Node.js LTS latest.
-   Yarn ≥ **3**.

## Setup

### 1. Setup yarn

```sh
# Please switch to node.js lts latest

cd acfun-live-toolbox-MKII
corepack enable
yarn set version stable
```

### 2. Setup development environment variables

⚠ ATTENTION: You should perform this step _every time_ you download anything with yarn.

_Windows:_

```batch
CALL dev-tools\setup_dev_envvars
```

_UNIX:_

```sh
source ./dev-tools/setup_dev_envvars.sh
```

### 3. Install dependencies

⚠ ATTENTION: You must create a new terminal to run code otherwise electron may not be built successfully.

```sh
yarn install
```

## Run & Debug

### Run the project directly

```sh
yarn run dev
```

### Debug in VSCode or Emacs (dap-mode)

![electron-vite-react-debug.gif](https://github.com/electron-vite/electron-vite-react/blob/main/electron-vite-react-debug.gif?raw=true)

### Debug in other editors

_Windows:_

```batch
node_modules\.bin\electron --remote-debugging-port=9229 .
```

_UNIX:_

```sh
node_modules/.bin/electron --remote-debugging-port=9229 .
```

Then attach your debugger to port 9229.

## Directory

```
  ├─┬ electron        == code that run in electron main thread.
  │ ├─┬ main
  │ │ └── index.ts    entry of Electron-Main
  │ └─┬ preload
  │   └── index.ts    entry of Preload-Scripts
  ├─┬ src             == code that run in electron renderer thread.
  │ └── main.ts       entry of Electron-Renderer
  ├── index.html
  ├── package.json
  └── vite.config.ts
```

## FAQ

-   [C/C++ addons, Node.js modules - Pre-Bundling](https://github.com/electron-vite/vite-plugin-electron-renderer#dependency-pre-bundling)
-   [dependencies vs devDependencies](https://github.com/electron-vite/vite-plugin-electron-renderer#dependencies-vs-devdependencies)



## ROAD MAP

- [x] ws服务改成eventsource（待测试）
- [ ] 迁移后端接口
- [ ] 重写弹幕服务
- [ ] 搞定路径问题
- [ ] 弹幕数据库
- [ ] 设计小程序架构
- [ ] 挂载生命周期钩子
- [ ] 自动更新
- [ ] 小程序市场
- [ ] 重新设计ui
- [ ] 重写基础小程序（弹幕鸡  obs推流等）