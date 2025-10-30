/**
 * @file Standardized data contracts for the entire application, as defined in the DDD.
 */

/**
 * The single, unified event shape used across the application.
 * All events from the adapter, stored in the database, and broadcasted via APIs will conform to this interface.
 */
export interface NormalizedEvent {
  ts: number;                 // ms since epoch
  room_id: string;
  event_type: NormalizedEventType;
  user_id?: string | null;
  user_name?: string | null;
  content?: string | null;
  raw: unknown;               // Sanitized raw event from the upstream library
}

/**
 * Defines the whitelist of event types the application will process.
 */
export type NormalizedEventType =
  | 'danmaku' | 'gift' | 'follow' | 'like' | 'enter' | 'system';

/**
 * Represents the connection status of a single live room.
 */
export type RoomStatus = 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting' | 'error';

/**
 * The payload broadcasted to clients when a room's status changes.
 */
export interface RoomStatusPayload {
  roomId: string;
  status: RoomStatus;
  reason?: string;
  retryInMs?: number;
}
