import { createRequire } from 'module';
const require = createRequire(import.meta.url);

if (process.env.NODE_ENV === 'development' || process.env.PLAYWRIGHT_TEST === 'true' || !!process.env.CI) {
  function showAndExit(...args) {
    console.error(...args);
    process.exit(1);
  }

  process.on('uncaughtException', showAndExit);
  process.on('unhandledRejection', showAndExit);
}

// 直接加载并运行 @app/main（其为 CJS，导出为 side-effect 入口）
require('@app/main');
