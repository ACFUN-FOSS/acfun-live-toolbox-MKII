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
 * Node.js LTS latest.
 * Yarn ≥ **3**.

## Setup
### 1. Setup yarn
```sh
# Please switch to node.js lts latest

cd acfun-live-toolbox-MKII
corepack enable
yarn set version stable
```
### 2. Setup development environment variables
⚠ ATTENTION: You should perform this step *every time* you download anything with yarn.

*Windows:*
```batch
CALL dev-tools\setup_dev_envvars
```
*UNIX:*
```sh
source ./dev-tools/setup_dev_envvars.sh
```
### 3. Install dependencies
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
*Windows:*
```batch
node_modules\.bin\electron --remote-debugging-port=9229 .
```
*UNIX:*
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
- [C/C++ addons, Node.js modules - Pre-Bundling](https://github.com/electron-vite/vite-plugin-electron-renderer#dependency-pre-bundling)
- [dependencies vs devDependencies](https://github.com/electron-vite/vite-plugin-electron-renderer#dependencies-vs-devdependencies)
