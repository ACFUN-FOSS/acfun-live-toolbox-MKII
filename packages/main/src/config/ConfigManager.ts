// Use runtime-safe import to handle ESM default export under CJS bundling
// Avoid relying on transpiler interop that produced `require('electron-store')` without `.default`.
type StoreCtor = new (...args: any[]) => {
  get: (key: string, defaultValue?: any) => any;
  set: (key: string, value: any) => void;
  // Conf exposes `.store` object; we use it for getAll()
  store?: Record<string, any>;
};

function resolveElectronStore(): StoreCtor {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('electron-store');
  const ctor = (mod && (mod.default ?? mod)) as StoreCtor | undefined;
  if (!ctor) {
    throw new Error('Failed to resolve electron-store constructor');
  }
  return ctor;
}

/**
 * Manages application configuration using electron-store.
 * This will be used for simple, non-event-based settings.
 */
export class ConfigManager {
  private store: InstanceType<StoreCtor>;

  constructor() {
    const Store = resolveElectronStore();
    this.store = new Store();
  }

  public get<T>(key: string, defaultValue?: T): T {
    return this.store.get(key, defaultValue) as T;
  }

  public set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  public getAll(): Record<string, any> {
    const raw = (this.store as any).store as Record<string, any> | undefined;
    return raw ? { ...raw } : {};
  }
}
