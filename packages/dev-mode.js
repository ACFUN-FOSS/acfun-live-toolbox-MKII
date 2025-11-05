process.env.NODE_PATH = 'packages';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('module')._initPaths();

import {build, createServer} from 'vite';
import path from 'path';

/**
 * This script is designed to run multiple packages of your application in a special development mode.
 * To do this, you need to follow a few steps:
 */


/**
 * 1. We create a few flags to let everyone know that we are in development mode.
 */
const mode = 'development';
process.env.NODE_ENV = mode;
process.env.MODE = mode;


/**
 * 2. We create a development server for the renderer. It is assumed that the renderer exists and is located in the “renderer” package.
 * This server should be started first because other packages depend on its settings.
 */
/**
 * @type {import('vite').ViteDevServer}
 */
const rendererWatchServer = await createServer({
  mode,
  root: path.resolve('packages/renderer'),
});

await rendererWatchServer.listen();

// 输出 renderer 开发服务器地址，便于在日志中获取预览 URL
try {
  const urls = rendererWatchServer.resolvedUrls || {};
  const local = (urls.local && urls.local[0]) || '';
  const network = (urls.network && urls.network[0]) || '';
  console.log(`[Renderer] Dev server running at: ${local || network || 'unknown'}`);
} catch (e) {
  console.log('[Renderer] Dev server URL not available');
}


/**
 * 3. We are creating a simple provider plugin.
 * Its only purpose is to provide access to the renderer dev-server to all other build processes.
 */
/** @type {import('vite').Plugin} */
const rendererWatchServerProvider = {
  name: '@app/renderer-watch-server-provider',
  api: {
    provideRendererWatchServer() {
      return rendererWatchServer;
    },
  },
};


/**
 * 4. Start building all other packages.
 * For each of them, we add a plugin provider so that each package can implement its own hot update mechanism.
 */

/** @type {string[]} */
const packagesToStart = [
  'packages/preload',
  'packages/main',
];

for (const pkg of packagesToStart) {
  await build({
    mode,
    root: path.resolve(pkg),
    plugins: [
      rendererWatchServerProvider,
    ],
  });
}
