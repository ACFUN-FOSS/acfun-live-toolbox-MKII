export {};

declare global {
  interface Window {
    electronApi: Record<string, any>;
  }
}
