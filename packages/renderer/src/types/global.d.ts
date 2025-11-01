// 扩展 Window 接口
interface Window {
  overlayApi?: {
    id: string;
    room: string;
    token: string;
    action: (actionId: string, data?: any) => void;
    close: () => void;
    update: (updates: any) => void;
  };
}

export {};