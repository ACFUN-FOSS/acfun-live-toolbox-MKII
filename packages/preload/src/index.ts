import { contextBridge, ipcRenderer } from 'electron';
import { sha256sum } from './nodeCrypto.js';
import { versions } from './versions.js';

// 暴露API给渲染进程
contextBridge.exposeInMainWorld('api', {
  sha256sum,
  versions,
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close')
  }
});
