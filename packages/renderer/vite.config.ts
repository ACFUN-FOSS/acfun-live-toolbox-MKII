import { defineConfig } from 'vite';
import * as path from 'path';
import vue from '@vitejs/plugin-vue';
import electronRenderer from 'vite-plugin-electron-renderer';
// https://vite.dev/config/
export default defineConfig({
  define: {
    '__dirname': JSON.stringify(__dirname),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
  },
  build: {
    rollupOptions: {
      external: ['electron', 'path'],
        output: {
          globals: {
            'electron': 'electron',
            'path': 'path'
          }
        }
    }
  },
  plugins: [vue(), electronRenderer()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
})
