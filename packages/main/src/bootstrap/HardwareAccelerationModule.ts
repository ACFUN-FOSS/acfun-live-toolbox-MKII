import { app } from 'electron';

export function setupHardwareAcceleration() {
  // Disable hardware acceleration for better performance
  app.disableHardwareAcceleration();
}
