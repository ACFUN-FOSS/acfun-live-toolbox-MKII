export {};

declare global {
  interface Window {
    electronApi: {
      dialog: {
        showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths?: string[]; error?: string }>;
        showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
      };
      fs: {
        exists: (path: string) => Promise<boolean>;
        readFile: (path: string) => Promise<string>;
        writeFile: (path: string, data: string) => Promise<boolean>;
      };
      login: {
        qrStart: () => Promise<{ qrCodeDataUrl: string; expiresIn?: number; expireAt?: number } | { error: string }>;
        qrCheck: () => Promise<{
          success: boolean;
          tokenInfo?: { accessToken: string; refreshToken: string; userID: string; expiresAt?: number; platform?: string };
          error?: string;
        }>;
        qrFinalize: () => Promise<{
          success: boolean;
          tokenInfo?: { accessToken: string; refreshToken: string; userID: string; expiresAt?: number; platform?: string };
          error?: string;
        }>;
        qrCancel: () => Promise<{ success: boolean } | { success: false; error: string }>;
        logout: () => Promise<{ ok: true }>;
      };
      account: {
        getUserInfo: () => Promise<
          | {
              success: true;
              data: {
                userId: string;
                userName: string;
                avatar: string;
                level?: number;
                fansCount?: number;
                followCount?: number;
                signature?: string;
                isLive?: boolean;
                liveRoomId?: string;
                avatarFrame?: string;
                contributeCount?: number;
                verifiedText?: string;
                isJoinUpCollege?: boolean;
                isFollowing?: boolean;
                isFollowed?: boolean;
                likeCount?: number;
              };
            }
          | { success: false; error: string }
        >;
      };
      window: {
        minimizeWindow: () => Promise<void>;
        closeWindow: () => Promise<void>;
        maximizeWindow: () => Promise<void>;
        restoreWindow: () => Promise<void>;
      };
      system: {
        getConfig: () => Promise<Record<string, any>>;
        updateConfig: (newConfig: any) => Promise<{ success: boolean; error?: string }>;
        getSystemLog: (count?: number) => Promise<any>;
        genDiagnosticZip: () => Promise<any>;
        showItemInFolder: (path: string) => Promise<{ success: boolean; error?: string }>;
        openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
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
        details: (
          roomId: string
        ) => Promise<
          | {
              success: true;
              data: {
                roomId: string;
                liveId?: string;
                title: string;
                isLive: boolean;
                status: string;
                startTime?: number;
                viewerCount?: number;
                likeCount?: number;
                coverUrl?: string;
                streamer?: {
                  userId: string;
                  userName: string;
                  avatar?: string;
                  level?: number;
                };
              };
            }
          | { success: false; error: string }
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
        get: (
          pluginId: string
        ) => Promise<
          | {
              success: true;
              data: {
                id: string;
                name: string;
                version: string;
                description?: string;
                enabled: boolean;
                author?: string;
                homepage?: string;
                manifest?: any;
              };
            }
          | { success: false; error: string }
        >;
        getConfig: (pluginId: string) => Promise<{ success: boolean; data?: Record<string, any>; error?: string }>;
        updateConfig: (pluginId: string, config: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
        stats: () => Promise<{ success: true; data: { total: number; enabled: number; disabled: number; error: number } }>;
        logs: (pluginId?: string, limit?: number) => Promise<{ logs: Array<{ level: string; message: string; timestamp: number; context?: any; }> } | { error: string }>;
        errorHistory: (pluginId: string) => Promise<{ errors: Array<{ type: string; message: string; timestamp: number; context?: any; recoveryAction?: string; }> } | { error: string }>;
        errorStats: () => Promise<{ stats: { totalErrors: number; errorsByType: Record<string, number>; errorsByPlugin: Record<string, number>; } } | { error: string }>;
        recovery: (pluginId: string, action: string, context?: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
        resetErrorCount: (pluginId: string, errorType?: string) => Promise<{ success: boolean; error?: string }>;
        saveDevConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
        loadDevConfig: (pluginId?: string) => Promise<{ success: boolean; config?: any; error?: string }>;
        getDebugStatus: (
          pluginId: string
        ) => Promise<
          | {
              success: true;
              data: { pluginId: string; config?: any; hotReloadEnabled?: boolean; debugActive?: boolean; lastConnection?: any };
            }
          | { success: false; error: string }
        >;
        startDebugSession: (config: any) => Promise<{ success: boolean; error?: string }>;
        stopDebugSession: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
        enableHotReload: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
        disableHotReload: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
        testConnection: (config: any) => Promise<{ success: boolean; error?: string }>;
        popup: {
          create: (pluginId: string, options: any) => Promise<{ success: boolean; popupId?: string; error?: string }>;
          close: (pluginId: string, popupId: string) => Promise<{ success: boolean; error?: string }>;
          action: (pluginId: string, popupId: string, actionId: string) => Promise<{ success: boolean; error?: string }>;
          bringToFront: (pluginId: string, popupId: string) => Promise<{ success: boolean; error?: string }>;
        };
      };
      wujie: {
        getUIConfig: (
          pluginId: string
        ) => Promise<
          | { success: true; data: { url: string; spa?: boolean; route?: string } | null }
          | { success: false; error: string }
        >;
        getOverlayConfig: (
          pluginId: string
        ) => Promise<
          | { success: true; data: { url: string; spa?: boolean; route?: string } | null }
          | { success: false; error: string }
        >;
      };
      hosting: {
        getConfig: (
          pluginId: string
        ) => Promise<
          | {
              success: true;
              data: {
                ui: { spa: boolean; route: string; html: string } | null;
                window: { spa: boolean; route: string; html: string } | null;
                overlay: { spa: boolean; route: string; html: string } | null;
              };
            }
          | { success: false; error: string }
        >;
      };
      http: {
        get: (path: string, params?: Record<string, any>) => Promise<any>;
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
        send: (overlayId: string, event: string, payload?: any) => Promise<{ success: boolean; error?: string }>;
      };
      console: {
        createSession: (options: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        endSession: (options: any) => Promise<{ success: boolean; error?: string }>;
        executeCommand: (options: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        getCommands: () => Promise<{ success: boolean; data?: any; error?: string }>;
        getSession: (options: any) => Promise<{ success: boolean; data?: any; error?: string }>;
        getActiveSessions: () => Promise<{ success: boolean; data?: any; error?: string }>;
      };
      on: (channel: string, listener: (...args: any[]) => void) => void;
      off: (channel: string, listener: (...args: any[]) => void) => void;
    };
  }
}
