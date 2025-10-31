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
    };
  }
}
