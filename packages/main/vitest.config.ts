import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.ts',
      '../../test/**/*.test.ts'
    ],
    exclude: [
      'node_modules',
      'dist'
    ],
    environment: 'node',
    testTimeout: 120000, // 增加到2分钟
    hookTimeout: 60000,  // 增加到1分钟
    teardownTimeout: 30000,
    reporter: 'dot', // 使用最简洁的dot reporter
    silent: false // 保持console.log可见
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@test': resolve(__dirname, '../../test')
    }
  }
});