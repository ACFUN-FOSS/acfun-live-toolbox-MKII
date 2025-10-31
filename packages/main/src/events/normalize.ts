import type { NormalizedEvent, NormalizedEventType } from '../types';

const ALLOWED_TYPES: NormalizedEventType[] = ['danmaku','gift','follow','like','enter','system'];

function clampType(t: any): NormalizedEventType {
  const s = String(t || '').toLowerCase();
  const mapped =
    s === 'comment' ? 'danmaku' :
    s === 'danmaku' ? 'danmaku' :
    s === 'gift' ? 'gift' :
    s === 'follow' ? 'follow' :
    s === 'like' ? 'like' :
    s === 'enter' ? 'enter' : 'system';
  return (ALLOWED_TYPES as string[]).includes(mapped) ? (mapped as NormalizedEventType) : 'system';
}

function sanitizeText(input: any, maxLen = 500): string | null {
  if (input == null) return null;
  let s = String(input);
  // 去除控制字符与多余空白
  s = s.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!s) return null;
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function ensureNormalized(event: NormalizedEvent): NormalizedEvent {
  const tsRaw = Number(event.ts ?? Date.now());
  const safeTs = Number.isFinite(tsRaw) ? tsRaw : Date.now();

  return {
    ts: safeTs,
    room_id: sanitizeText(event.room_id, 128) || String(event.room_id || ''),
    event_type: clampType(event.event_type),
    user_id: sanitizeText(event.user_id, 128),
    user_name: sanitizeText(event.user_name, 128),
    content: sanitizeText(event.content, 500),
    raw: event.raw ?? null
  };
}