/**
 * @module preload
 */

import { contextBridge } from 'electron';

/**
 * An empty object for now.
 * This will be populated with the actual API as we rebuild the features.
 */
const api = {};

/**
 * The "api" is exposed on the window object in the renderer process.
 * See `packages/renderer/src/global.d.ts` for type declarations.
 */
try {
  contextBridge.exposeInMainWorld('electronApi', api);
} catch (error) {
  console.error('Failed to expose preload API:', error);
}
