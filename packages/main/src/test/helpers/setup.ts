import { vi } from 'vitest';
import path from 'path';
import os from 'os';

// Mock Electron app
const mockApp = {
  getPath: vi.fn((name: string) => {
    switch (name) {
      case 'userData':
        return path.join(os.tmpdir(), 'test-app-data');
      case 'logs':
        return path.join(os.tmpdir(), 'test-app-logs');
      case 'temp':
        return os.tmpdir();
      default:
        return os.tmpdir();
    }
  }),
  getName: vi.fn(() => 'test-app'),
  getVersion: vi.fn(() => '1.0.0'),
  isReady: vi.fn(() => true),
  whenReady: vi.fn(() => Promise.resolve()),
  quit: vi.fn(),
  exit: vi.fn(),
};

// Mock Electron BrowserWindow
const mockBrowserWindow = vi.fn(() => ({
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  show: vi.fn(),
  hide: vi.fn(),
  close: vi.fn(),
  destroy: vi.fn(),
  isDestroyed: vi.fn(() => false),
  webContents: {
    send: vi.fn(),
    executeJavaScript: vi.fn(),
    openDevTools: vi.fn(),
    closeDevTools: vi.fn(),
  },
  on: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
}));

// Mock Electron ipcMain
const mockIpcMain = {
  handle: vi.fn(),
  on: vi.fn(),
  once: vi.fn(),
  removeHandler: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
};

// Mock Electron dialog
const mockDialog = {
  showOpenDialog: vi.fn(),
  showSaveDialog: vi.fn(),
  showMessageBox: vi.fn(),
  showErrorBox: vi.fn(),
};

// Mock Electron shell
const mockShell = {
  openExternal: vi.fn(),
  openPath: vi.fn(),
  showItemInFolder: vi.fn(),
  moveItemToTrash: vi.fn(),
};

// Mock the entire electron module
vi.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: mockBrowserWindow,
  ipcMain: mockIpcMain,
  dialog: mockDialog,
  shell: mockShell,
  nativeTheme: {
    shouldUseDarkColors: false,
    themeSource: 'system',
  },
}));

// Mock fs promises for file operations
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  access: vi.fn(),
  unlink: vi.fn(),
  rmdir: vi.fn(),
}));

// Mock fs sync operations
vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(() => ({
    isDirectory: () => false,
    isFile: () => true,
    size: 1024,
    mtime: new Date(),
  })),
}));

// Export mocks for use in tests
export {
  mockApp,
  mockBrowserWindow,
  mockIpcMain,
  mockDialog,
  mockShell,
};