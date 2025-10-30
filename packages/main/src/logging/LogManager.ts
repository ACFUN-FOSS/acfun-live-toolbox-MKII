// Simple LogManager implementation for TypeScript compatibility

export interface LogManager {
  addLog(source: string, message: string, level: 'info' | 'error' | 'warn' | 'debug'): void;
}

class SimpleLogManager implements LogManager {
  addLog(source: string, message: string, level: 'info' | 'error' | 'warn' | 'debug'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}`;
    
    switch (level) {
      case 'error':
        console.error(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'debug':
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }
}

let logManagerInstance: LogManager | null = null;

export function getLogManager(): LogManager {
  if (!logManagerInstance) {
    logManagerInstance = new SimpleLogManager();
  }
  return logManagerInstance;
}