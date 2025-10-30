// Simple danmuEventSourceConnector implementation for TypeScript compatibility

export interface DanmuEventSourceConnector {
  connectToRoom(roomId: string): Promise<void>;
  disconnectFromRoom(): Promise<void>;
}

class SimpleDanmuEventSourceConnector implements DanmuEventSourceConnector {
  private currentRoomId: string | null = null;

  async connectToRoom(roomId: string): Promise<void> {
    console.log(`[DanmuEventSourceConnector] Connecting to room: ${roomId}`);
    this.currentRoomId = roomId;
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`[DanmuEventSourceConnector] Connected to room: ${roomId}`);
  }

  async disconnectFromRoom(): Promise<void> {
    if (this.currentRoomId) {
      console.log(`[DanmuEventSourceConnector] Disconnecting from room: ${this.currentRoomId}`);
      this.currentRoomId = null;
      // Simulate disconnection delay
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log(`[DanmuEventSourceConnector] Disconnected from room`);
    }
  }
}

const danmuEventSourceConnector = new SimpleDanmuEventSourceConnector();
export default danmuEventSourceConnector;