declare module 'chokidar' {
  import { EventEmitter } from 'events';

  export interface FSWatcher extends EventEmitter {
    close(): Promise<void>;
    on(event: 'change', listener: (path: string, stats?: any) => void): this;
    on(event: 'add', listener: (path: string, stats?: any) => void): this;
    on(event: 'unlink', listener: (path: string) => void): this;
    on(event: 'addDir', listener: (path: string, stats?: any) => void): this;
    on(event: 'unlinkDir', listener: (path: string) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'ready', listener: () => void): this;
    on(event: 'raw', listener: (event: string, path: string, details: any) => void): this;
  }

  export interface WatchOptions {
    ignored?: RegExp | string | ((path: string) => boolean);
    ignoreInitial?: boolean;
    followSymlinks?: boolean;
    cwd?: string;
    disableGlobbing?: boolean;
    usePolling?: boolean;
    interval?: number;
    binaryInterval?: number;
    alwaysStat?: boolean;
    depth?: number;
    awaitWriteFinish?: boolean | {
      stabilityThreshold?: number;
      pollInterval?: number;
    };
    ignorePermissionErrors?: boolean;
    atomic?: boolean | number;
    persistent?: boolean;
  }

  export function watch(paths: string | string[], options?: WatchOptions): FSWatcher;
}