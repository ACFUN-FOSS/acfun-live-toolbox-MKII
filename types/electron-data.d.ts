declare module 'electron-data' {
  interface ElectronDataConfigOptions {
    filename?: string;
    path?: string;
    autosave?: boolean;
    prettysave?: boolean;
  }

  function config(options: ElectronDataConfigOptions): void;
  function get<T = any>(key: string): Promise<T | undefined>;
  function set<T = any>(key: string, value: T): Promise<void>;
  function unset(key: string): Promise<void>;
  function has(key: string): Promise<boolean>;
  function getAll<T = Record<string, any>>(): Promise<T>;
  function clear(): Promise<void>;
  function deleteFile(): Promise<boolean>;
  function path(): string;
}