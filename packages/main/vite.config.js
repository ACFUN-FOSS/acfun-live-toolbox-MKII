import {getNodeMajorVersion} from '@app/electron-versions';
import {spawn} from 'child_process';
import electronPath from 'electron';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: true,
    sourcemap: 'inline',
    outDir: 'dist',
    assetsDir: '.',
    target: `node${getNodeMajorVersion()}`,
    lib: {
      entry: 'src/index.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        '@app/acfundanmu',
        'chokidar',
        'acfunlive-http-api',
        'electron',
        'electron-store',
        'express',
        'cors',
        'helmet',
        'morgan',
        'compression',
        'sqlite3',
        'adm-zip',
        'archiver',
        'tar',
        'uuid',
        'obs-websocket-js'
      ],
      output: {
        entryFileNames: '[name].cjs',
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  plugins: [
    handleHotReload(),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['src/test/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
});


/**
 * Implement Electron app reload when some file was changed
 * @return {import('vite').Plugin}
 */
function handleHotReload() {

  /** @type {ChildProcess} */
  let electronApp = null;

  /** @type {import('vite').ViteDevServer|null} */
  let rendererWatchServer = null;

  return {
    name: '@app/main-process-hot-reload',

    config(config, env) {
      if (env.mode !== 'development') {
        return;
      }

      const rendererWatchServerProvider = config.plugins.find(p => p.name === '@app/renderer-watch-server-provider');
      if (!rendererWatchServerProvider) {
        throw new Error('Renderer watch server provider not found');
      }

      rendererWatchServer = rendererWatchServerProvider.api.provideRendererWatchServer();

      process.env.VITE_DEV_SERVER_URL = rendererWatchServer.resolvedUrls.local[0];

      return {
        build: {
          watch: {},
        },
      };
    },

    writeBundle() {
      if (process.env.NODE_ENV !== 'development') {
        return;
      }

      /** Kill electron if a process already exists */
      if (electronApp !== null) {
        electronApp.removeListener('exit', process.exit);
        electronApp.kill('SIGINT');
        electronApp = null;
      }

      /** Spawn a new electron process */
      // Drop inspector flag to avoid potential crashes in some Windows environments
      electronApp = spawn(String(electronPath), ['.'], {
        stdio: 'inherit',
      });

      /** Stops the watch script when the application has been quit */
      electronApp.addListener('exit', process.exit);
    },
  };
}
