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
}
