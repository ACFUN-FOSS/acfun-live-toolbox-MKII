/**
 * AcFun Live API 类型定义
 */

// 基础响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
  message?: string;
}

// 速率限制类型
export interface RateLimitConfig {
  requests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitStatus {
  requests: number;
  remaining: number;
  resetTime: number;
  windowMs: number;
}

// 认证相关类型
export interface AuthStatus {
  isAuthenticated: boolean;
  userId?: string;
  username?: string;
  tokenExpiry?: number;
}

export interface QRLoginRequest {
  callback?: string;
}

export interface QRLoginResponse {
  qrCode: string;
  qrCodeUrl: string;
  sessionId: string;
  expiresIn: number;
}

export interface QRStatusRequest {
  sessionId: string;
}

export interface QRStatusResponse {
  status: 'pending' | 'scanned' | 'confirmed' | 'expired' | 'cancelled';
  userId?: string;
  username?: string;
  token?: string;
}

export interface TokenRequest {
  token: string;
  userId?: string;
}

// 用户相关类型
export interface UserInfo {
  userId: string;
  username: string;
  avatar?: string;
  level?: number;
  followCount?: number;
  fanCount?: number;
  acCoin?: number;
  banana?: number;
}

export interface WalletInfo {
  acCoin: number;
  banana: number;
  totalRecharge?: number;
  totalConsume?: number;
}

// 弹幕相关类型
export interface DanmuStartRequest {
  roomId: string;
  userId?: string;
}

export interface DanmuStopRequest {
  roomId: string;
}

export interface LiveRoomInfo {
  roomId: string;
  title: string;
  owner: {
    userId: string;
    username: string;
    avatar?: string;
  };
  status: 'live' | 'offline';
  viewerCount?: number;
  likeCount?: number;
  category?: string;
  tags?: string[];
}

// 直播相关类型
export interface LivePermissionResponse {
  canLive: boolean;
  reason?: string;
  restrictions?: string[];
}

export interface StreamUrlRequest {
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  format?: 'flv' | 'hls' | 'rtmp';
}

export interface StreamUrlResponse {
  url: string;
  quality: string;
  format: string;
  expiresAt?: number;
}

export interface StreamSettings {
  title: string;
  category: string;
  tags?: string[];
  description?: string;
  coverImage?: string;
  isPrivate?: boolean;
}

export interface StreamStatus {
  isLive: boolean;
  startTime?: number;
  duration?: number;
  viewerCount?: number;
  likeCount?: number;
  giftCount?: number;
}

export interface LiveStatistics {
  totalViews: number;
  peakViewers: number;
  totalLikes: number;
  totalGifts: number;
  totalRevenue?: number;
  averageViewTime?: number;
}

export interface LiveSummary {
  roomId: string;
  title: string;
  duration: number;
  viewerCount: number;
  likeCount: number;
  giftCount: number;
  revenue?: number;
  highlights?: string[];
}

export interface HotLive {
  roomId: string;
  title: string;
  owner: {
    userId: string;
    username: string;
    avatar?: string;
  };
  viewerCount: number;
  category: string;
  coverImage?: string;
}

export interface LiveCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  liveCount?: number;
}

export interface UserLiveInfo {
  userId: string;
  username: string;
  roomId?: string;
  isLive: boolean;
  title?: string;
  viewerCount?: number;
  followCount?: number;
  fanCount?: number;
}

export interface ClipPermission {
  canClip: boolean;
  maxDuration?: number;
  cooldownTime?: number;
  reason?: string;
}

// 礼物相关类型
export interface Gift {
  id: string;
  name: string;
  price: number;
  icon?: string;
  description?: string;
  category?: string;
  isAvailable: boolean;
}

export interface LiveGiftRequest {
  roomId: string;
}

// 房管相关类型
export interface Manager {
  userId: string;
  username: string;
  avatar?: string;
  level: number;
  addedAt: number;
  addedBy?: string;
}

export interface AddManagerRequest {
  userId: string;
  username?: string;
}

export interface RemoveManagerRequest {
  userId: string;
}

export interface KickRecord {
  id: string;
  targetUserId: string;
  targetUsername: string;
  operatorUserId: string;
  operatorUsername: string;
  reason?: string;
  kickedAt: number;
  duration?: number;
}

export interface KickUserRequest {
  userId: string;
  reason?: string;
  duration?: number; // 踢出时长（秒），不设置则为永久
}

// API 请求类型
export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

// 配置类型
export interface AcfunApiProxyConfig {
  enableAuth?: boolean;
  enableRateLimit?: boolean;
  enableRetry?: boolean;
  enableLogging?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  allowedOrigins?: string[];
}

// 错误类型
export interface ApiError {
  code: number;
  message: string;
  details?: any;
  timestamp: number;
}

// 事件类型
export interface DanmuEvent {
  type: 'comment' | 'gift' | 'like' | 'follow' | 'enter' | 'leave';
  roomId: string;
  userId: string;
  username: string;
  timestamp: number;
  data: any;
}

export interface CommentEvent extends DanmuEvent {
  type: 'comment';
  data: {
    content: string;
    level?: number;
    medal?: {
      name: string;
      level: number;
    };
  };
}

export interface GiftEvent extends DanmuEvent {
  type: 'gift';
  data: {
    giftId: string;
    giftName: string;
    count: number;
    price: number;
    combo?: number;
  };
}