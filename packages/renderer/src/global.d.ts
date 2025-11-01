export {};

declare global {
  interface Window {
    electronApi: {
      login: {
        qrStart: () => Promise<{ qrCodeDataUrl: string; expiresIn: number } | { error: string }>;
        qrCheck: () => Promise<{ success: boolean; userId?: string; expiresAt?: number; error?: string }>;
        logout: () => Promise<{ ok: true }>;
      };
      room: {
        connect: (roomId: string) => Promise<{ success: boolean; code?: string; error?: string }>;
        disconnect: (roomId: string) => Promise<{ success: boolean; code?: string; error?: string }>;
        list: () => Promise<
          | { rooms: Array<{ roomId: string; status: string; eventCount: number; connectedAt: number | null; lastEventAt: number | null; reconnectAttempts: number }> }
          | { error: string }
        >;
        status: (roomId: string) => Promise<
          | { roomId: string; status: string; eventCount: number; connectedAt: number | null; lastEventAt: number | null; reconnectAttempts: number }
          | { error: string }
        >;
        setPriority: (roomId: string, priority: number) => Promise<{ success: boolean; code?: string; error?: string }>;
        setLabel: (roomId: string, label: string) => Promise<{ success: boolean; code?: string; error?: string }>;
      };
      plugin: {
        list: () => Promise<{ plugins: Array<{ id: string; name: string; version: string; description?: string; enabled: boolean; author?: string; homepage?: string; }> } | { error: string }>;
        install: (options: { filePath?: string; url?: string; force?: boolean }) => Promise<{ success: boolean; pluginId?: string; error?: string }>;
        uninstall: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
        enable: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
        disable: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
        get: (pluginId: string) => Promise<{ plugin: { id: string; name: string; version: string; description?: string; enabled: boolean; author?: string; homepage?: string; } } | { error: string }>;
        stats: () => Promise<{ stats: { total: number; enabled: number; disabled: number; } } | { error: string }>;
        logs: (pluginId?: string, limit?: number) => Promise<{ logs: Array<{ level: string; message: string; timestamp: number; context?: any; }> } | { error: string }>;
        errorHistory: (pluginId: string) => Promise<{ errors: Array<{ type: string; message: string; timestamp: number; context?: any; recoveryAction?: string; }> } | { error: string }>;
        errorStats: () => Promise<{ stats: { totalErrors: number; errorsByType: Record<string, number>; errorsByPlugin: Record<string, number>; } } | { error: string }>;
        recovery: (pluginId: string, action: string, context?: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
        resetErrorCount: (pluginId: string, errorType?: string) => Promise<{ success: boolean; error?: string }>;
        popup: {
          create: (pluginId: string, options: any) => Promise<{ success: boolean; popupId?: string; error?: string }>;
          close: (pluginId: string, popupId: string) => Promise<{ success: boolean; error?: string }>;
          action: (pluginId: string, popupId: string, actionId: string) => Promise<{ success: boolean; error?: string }>;
          bringToFront: (pluginId: string, popupId: string) => Promise<{ success: boolean; error?: string }>;
        };
      };
      overlay: {
        create: (options: any) => Promise<{ success: boolean; overlayId?: string; error?: string }>;
        update: (overlayId: string, updates: any) => Promise<{ success: boolean; error?: string }>;
        close: (overlayId: string) => Promise<{ success: boolean; error?: string }>;
        show: (overlayId: string) => Promise<{ success: boolean; error?: string }>;
        hide: (overlayId: string) => Promise<{ success: boolean; error?: string }>;
        bringToFront: (overlayId: string) => Promise<{ success: boolean; error?: string }>;
        list: () => Promise<{ overlays: Array<{ id: string; type: string; visible: boolean; createdAt: number; }> } | { error: string }>;
        action: (overlayId: string, action: string, data?: any) => Promise<{ success: boolean; error?: string }>;
      };
      on: (channel: string, listener: (...args: any[]) => void) => void;
      off: (channel: string, listener: (...args: any[]) => void) => void;
    };
  }
}
