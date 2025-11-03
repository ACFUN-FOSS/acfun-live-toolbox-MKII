import { BrowserWindow } from 'electron';
import path from 'path';

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

/**
 * A simplified window manager for creating and managing the application's main window.
 * This is a refactored version, stripped of the old module system dependencies.
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    // The constructor is simplified and no longer requires initConfig.
  }

  public createWindow(): void {
    this.mainWindow = new BrowserWindow({
      show: false, // Use 'ready-to-show' event to show the window
      width: 1024,
      height: 768,
      frame: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Sandbox is disabled for now, as per original config
        preload: path.join(__dirname, '../../preload/dist/exposed.mjs'), // Path to the preload script (ESM)
      },
    });

    // Set Content Security Policy to allow TDesign icons
    this.mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' data:;",
            "script-src 'self' 'unsafe-inline' https://tdesign.gtimg.com;",
            "style-src 'self' 'unsafe-inline' https://tdesign.gtimg.com;",
            "font-src 'self' data: https://tdesign.gtimg.com;",
            "img-src 'self' data: blob: https://tdesign.gtimg.com;",
            "connect-src 'self' https: http://127.0.0.1:* ws://127.0.0.1:* wss://127.0.0.1:*;"
          ].join(' ')
        }
      });
    });

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      // Automatically open DevTools in development
      if (VITE_DEV_SERVER_URL) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // Load the renderer content
    if (VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(VITE_DEV_SERVER_URL);
    } else {
      // In production, load the index.html file
      this.mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }
}
