import { expect, test, _electron as electron } from '@playwright/test';
import {globSync} from 'glob';
import {platform} from 'node:process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import {createHash} from 'node:crypto';

process.env.PLAYWRIGHT_TEST = 'true';

// Declare the types of your fixtures.
let electronApp: any;
let page: any;

test.beforeAll(async () => {
  let candidates: string[] = [];
  if (platform === 'win32') {
    candidates = globSync('dist/win-unpacked/*.exe');
    candidates = candidates.filter(p => !/elevate\.exe$/i.test(p) && !/uninstaller/i.test(p));
  } else if (platform === 'darwin') {
    candidates = globSync('dist/*.app/Contents/MacOS/*');
  } else {
    candidates = globSync('dist/*/root{,.*}');
  }

  // 为稳定起见，直接使用本地 Electron 二进制 + 项目入口脚本
  const executablePath = require('electron');
  const args = ['packages/entry-point.mjs', '--no-sandbox'];
  electronApp = await electron.launch({ executablePath, args });

  electronApp.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[electron][${msg.type()}] ${msg.text()}`);
    }
  });

  page = await electronApp.firstWindow();
  page.on('pageerror', (error) => console.error(error));
  page.on('console', (msg) => console.log(msg.text()));
  await page.waitForLoadState('load');

  // no-op
});

test.afterAll(async () => {
  await electronApp.close();
});


test('Main window loads renderer content', async () => {
  // 页面应当载入 renderer 的 index.html
  await expect(page).toHaveTitle(/Vite \+ Vue \+ TS/i);
  // 顶部标题存在
  const header = page.getByRole('heading', { level: 1, name: /AcFun Live Toolbox MKII/i });
  await expect(header).toBeVisible();
});

test.describe('Main window web content', () => {
  test('Has a reconnect button', async () => {
    const btn = page.getByRole('button', { name: /重连/i });
    await expect(btn).toBeVisible();
    await btn.click();
  });
});

test.describe('Preload context exposure', () => {
  test('electronApi exists on window', async () => {
    const type = await page.evaluate(() => typeof (window as any).electronApi);
    expect(type).toEqual('object');
  });
});
