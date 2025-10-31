import pkg from './package.json' with {type: 'json'};
import mapWorkspaces from '@npmcli/map-workspaces';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Optional: enforce proxy for electron-builder downloads when USE_BUILDER_PROXY=1
if (process.env.USE_BUILDER_PROXY === '1') {
  const proxy = process.env.BUILDER_PROXY_URL || 'http://127.0.0.1:1022';
  process.env.HTTP_PROXY = proxy;
  process.env.HTTPS_PROXY = proxy;
  process.env.ALL_PROXY = proxy;
  process.env.npm_config_proxy = proxy;
  process.env.npm_config_https_proxy = proxy;
  process.env.YARN_PROXY = proxy;
  process.env.YARN_HTTPS_PROXY = proxy;
  // Prefer npmmirror to avoid GitHub direct downloads behind strict proxies
  process.env.ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/';
  // Some environments require disabling strict SSL for corporate proxies
  if (!process.env.npm_config_strict_ssl) process.env.npm_config_strict_ssl = 'false';
  console.log('[electron-builder] Proxy enabled via USE_BUILDER_PROXY=1:', proxy);
}

export default /** @type import('electron-builder').Configuration */
({
  directories: {
    output: 'dist',
    buildResources: 'buildResources',
  },
  // 强制 electron-builder 下载 Electron 二进制时使用国内镜像与代理
  // 说明：electron-builder 在下载 Electron 时会遵循环境变量 `HTTP_PROXY`/`HTTPS_PROXY`，
  // 同时也支持 `electronDownload` 配置以覆盖下载源（mirror）。
  electronDownload: {
    // 使用 npmmirror 的 Electron 镜像，避免 GitHub 直连
    mirror: 'https://npmmirror.com/mirrors/electron/',
    // 也可设置自定义目录（版本目录），保持默认即可
    // customDir: 'v${version}/',
    // requestOptions 可在新版本中传递，但 26.x 下主要依赖环境代理
  },
  generateUpdatesFilesForAllChannels: true,
  linux: {
    target: ['deb'],
  },
  /**
   * It is recommended to avoid using non-standard characters such as spaces in artifact names,
   * as they can unpredictably change during deployment, making them impossible to locate and download for update.
   */
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  files: [
    'LICENSE*',
    pkg.main,
    '!node_modules/@app/**',
    ...await getListOfFilesFromEachWorkspace(),
  ],
});

/**
 * By default, electron-builder copies each package into the output compilation entirety,
 * including the source code, tests, configuration, assets, and any other files.
 *
 * So you may get compiled app structure like this:
 * ```
 * app/
 * ├── node_modules/
 * │   └── workspace-packages/
 * │       ├── package-a/
 * │       │   ├── src/            # Garbage. May be safely removed
 * │       │   ├── dist/
 * │       │   │   └── index.js    # Runtime code
 * │       │   ├── vite.config.js  # Garbage
 * │       │   ├── .env            # some sensitive config
 * │       │   └── package.json
 * │       ├── package-b/
 * │       ├── package-c/
 * │       └── package-d/
 * ├── packages/
 * │   └── entry-point.js
 * └── package.json
 * ```
 *
 * To prevent this, we read the “files”
 * property from each package's package.json
 * and add all files that do not match the patterns to the exclusion list.
 *
 * This way,
 * each package independently determines which files will be included in the final compilation and which will not.
 *
 * So if `package-a` in its `package.json` describes
 * ```json
 * {
 *   "name": "package-a",
 *   "files": [
 *     "dist/**\/"
 *   ]
 * }
 * ```
 *
 * Then in the compilation only those files and `package.json` will be included:
 * ```
 * app/
 * ├── node_modules/
 * │   └── workspace-packages/
 * │       ├── package-a/
 * │       │   ├── dist/
 * │       │   │   └── index.js    # Runtime code
 * │       │   └── package.json
 * │       ├── package-b/
 * │       ├── package-c/
 * │       └── package-d/
 * ├── packages/
 * │   └── entry-point.js
 * └── package.json
 * ```
 */
async function getListOfFilesFromEachWorkspace() {

  /**
   * @type {Map<string, string>}
   */
  const workspaces = await mapWorkspaces({
    cwd: process.cwd(),
    pkg,
  });

  const allFilesToInclude = [];

  for (const [name, path] of workspaces) {
    const pkgPath = join(path, 'package.json');
    const {default: workspacePkg} = await import(pathToFileURL(pkgPath), {with: {type: 'json'}});

    let patterns = workspacePkg.files || ['dist/**', 'package.json'];

    patterns = patterns.map(p => join('node_modules', name, p));
    allFilesToInclude.push(...patterns);
  }

  return allFilesToInclude;
}
