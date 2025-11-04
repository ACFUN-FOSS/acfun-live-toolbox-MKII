import Store from 'electron-store';

/**
 * Manages application configuration using electron-store.
 * This will be used for simple, non-event-based settings.
 */
export class ConfigManager {
  private store: Store;

  constructor() {
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

  public setAll(updates: Record<string, any>): void {
    for (const [key, value] of Object.entries(updates)) {
      this.store.set(key, value);
    }
  }

  public delete(key: string): void {
    this.store.delete(key);
  }
}
