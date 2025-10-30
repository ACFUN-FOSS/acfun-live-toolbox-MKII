// Simple DataManager implementation for TypeScript compatibility

export interface DataManager {
  subscribe(event: string, source: string, target: string, callback: (data: any) => void): void;
}

class SimpleDataManager implements DataManager {
  private static instance: SimpleDataManager | null = null;
  private subscribers: Map<string, Array<(data: any) => void>> = new Map();

  static getInstance(): SimpleDataManager {
    if (!SimpleDataManager.instance) {
      SimpleDataManager.instance = new SimpleDataManager();
    }
    return SimpleDataManager.instance;
  }

  subscribe(event: string, source: string, target: string, callback: (data: any) => void): void {
    const key = `${event}:${source}:${target}`;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key)!.push(callback);
  }

  emit(event: string, source: string, target: string, data: any): void {
    const key = `${event}:${source}:${target}`;
    const callbacks = this.subscribers.get(key);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

export const DataManager = {
  getInstance: (): SimpleDataManager => SimpleDataManager.getInstance()
};