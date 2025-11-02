import { TypedEventEmitter } from '../utils/TypedEventEmitter';
import { pluginLogger } from './PluginLogger';
import * as crypto from 'crypto';

export interface SecureMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  signature?: string;
  encrypted?: boolean;
}

export interface CommunicationChannelConfig {
  enableEncryption: boolean;
  enableSigning: boolean;
  maxMessageSize: number;
  messageTimeout: number;
  rateLimitPerSecond: number;
}

export interface ChannelEvents {
  'message.received': { channelId: string; message: SecureMessage };
  'message.sent': { channelId: string; message: SecureMessage };
  'message.timeout': { channelId: string; messageId: string };
  'rate.limit.exceeded': { channelId: string; pluginId: string };
  'channel.error': { channelId: string; error: Error };
}

export class SecureCommunicationChannel extends TypedEventEmitter<ChannelEvents> {
  private config: CommunicationChannelConfig;
  private channels: Map<string, ChannelInfo> = new Map();
  private pendingMessages: Map<string, PendingMessage> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private encryptionKey?: Buffer;
  private signingKey?: Buffer;

  constructor(config: Partial<CommunicationChannelConfig> = {}) {
    super();
    
    this.config = {
      enableEncryption: config.enableEncryption || false,
      enableSigning: config.enableSigning || true,
      maxMessageSize: config.maxMessageSize || 1024 * 1024, // 1MB
      messageTimeout: config.messageTimeout || 30000, // 30 seconds
      rateLimitPerSecond: config.rateLimitPerSecond || 100,
    };

    if (this.config.enableEncryption) {
      this.encryptionKey = crypto.randomBytes(32);
    }
    
    if (this.config.enableSigning) {
      this.signingKey = crypto.randomBytes(64);
    }

    pluginLogger.info('SecureCommunicationChannel initialized', undefined, { 
      config: this.config 
    });
  }

  public createChannel(channelId: string, pluginId: string, worker: any): void {
    if (this.channels.has(channelId)) {
      throw new Error(`Channel ${channelId} already exists`);
    }

    const channel: ChannelInfo = {
      channelId,
      pluginId,
      worker,
      createdAt: Date.now(),
      messageCount: 0,
      lastActivity: Date.now(),
    };

    this.channels.set(channelId, channel);
    this.rateLimiters.set(channelId, new RateLimiter(this.config.rateLimitPerSecond));

    // Set up worker message handling
    worker.on('message', (message: any) => {
      this.handleWorkerMessage(channelId, message);
    });

    worker.on('error', (error: Error) => {
      this.emit('channel.error', { channelId, error });
    });

    pluginLogger.info('Communication channel created', pluginId, { channelId, pluginId });
  }

  public removeChannel(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Clean up pending messages for this channel
    for (const [messageId, pendingMessage] of this.pendingMessages) {
      if (pendingMessage.channelId === channelId) {
        clearTimeout(pendingMessage.timeoutId);
        this.pendingMessages.delete(messageId);
      }
    }

    this.channels.delete(channelId);
    this.rateLimiters.delete(channelId);

    pluginLogger.info('Communication channel removed', channel.pluginId, { 
      channelId, 
      pluginId: channel.pluginId 
    });
  }

  public async sendMessage(
    channelId: string, 
    type: string, 
    payload: any,
    expectResponse: boolean = false
  ): Promise<any> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const rateLimiter = this.rateLimiters.get(channelId);
    if (rateLimiter && !rateLimiter.allowRequest()) {
      this.emit('rate.limit.exceeded', { channelId, pluginId: channel.pluginId });
      throw new Error(`Rate limit exceeded for channel ${channelId}`);
    }

    const message: SecureMessage = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
    };

    // Validate message size
    const messageSize = Buffer.byteLength(JSON.stringify(message));
    if (messageSize > this.config.maxMessageSize) {
      throw new Error(`Message size ${messageSize} exceeds limit ${this.config.maxMessageSize}`);
    }

    // Apply security measures
    await this.secureMessage(message);

    try {
      channel.worker.postMessage(message);
      channel.messageCount++;
      channel.lastActivity = Date.now();

      this.emit('message.sent', { channelId, message });

      if (expectResponse) {
        return this.waitForResponse(channelId, message.id);
      }
    } catch (error) {
      const errorMessage = `Failed to send message - channelId: ${channelId}, messageId: ${message.id}, error: ${error instanceof Error ? error.message : String(error)}`;
      pluginLogger.error(errorMessage);
      throw error;
    }
  }

  private async secureMessage(message: SecureMessage): Promise<void> {
    if (this.config.enableEncryption && this.encryptionKey) {
      message.payload = await this.encryptPayload(message.payload);
      message.encrypted = true;
    }

    if (this.config.enableSigning && this.signingKey) {
      message.signature = this.signMessage(message);
    }
  }

  private async encryptPayload(payload: any): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey!, iv);
    
    let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private async decryptPayload(encryptedPayload: string): Promise<any> {
    const [ivHex, encrypted] = encryptedPayload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey!, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  private signMessage(message: SecureMessage): string {
    const messageData = JSON.stringify({
      id: message.id,
      type: message.type,
      payload: message.payload,
      timestamp: message.timestamp,
    });
    
    return crypto
      .createHmac('sha256', this.signingKey!)
      .update(messageData)
      .digest('hex');
  }

  private verifySignature(message: SecureMessage): boolean {
    if (!message.signature || !this.signingKey) return false;
    
    const expectedSignature = this.signMessage({
      ...message,
      signature: undefined,
    });
    
    return crypto.timingSafeEqual(
      Buffer.from(message.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  private async handleWorkerMessage(channelId: string, message: SecureMessage): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    try {
      // Verify signature if enabled
      if (this.config.enableSigning && !this.verifySignature(message)) {
        throw new Error('Message signature verification failed');
      }

      // Decrypt payload if encrypted
      if (message.encrypted && this.config.enableEncryption) {
        message.payload = await this.decryptPayload(message.payload);
      }

      channel.lastActivity = Date.now();
      this.emit('message.received', { channelId, message });

      // Handle response messages
      const pendingMessage = this.pendingMessages.get(message.id);
      if (pendingMessage) {
        clearTimeout(pendingMessage.timeoutId);
        this.pendingMessages.delete(message.id);
        pendingMessage.resolve(message.payload);
      }

    } catch (error) {
      pluginLogger.error('Error handling worker message', undefined, error instanceof Error ? error : new Error(String(error)), {
        channelId,
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.emit('channel.error', { 
        channelId, 
        error: error instanceof Error ? error : new Error(String(error)) 
      });
    }
  }

  private waitForResponse(channelId: string, messageId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        this.emit('message.timeout', { channelId, messageId });
        reject(new Error(`Message timeout: ${messageId}`));
      }, this.config.messageTimeout);

      this.pendingMessages.set(messageId, {
        channelId,
        messageId,
        resolve,
        reject,
        timeoutId,
        createdAt: Date.now(),
      });
    });
  }

  public getChannelStats(channelId: string): ChannelStats | null {
    const channel = this.channels.get(channelId);
    if (!channel) return null;

    const rateLimiter = this.rateLimiters.get(channelId);
    
    return {
      channelId,
      pluginId: channel.pluginId,
      messageCount: channel.messageCount,
      lastActivity: channel.lastActivity,
      uptime: Date.now() - channel.createdAt,
      pendingMessages: Array.from(this.pendingMessages.values())
        .filter(pm => pm.channelId === channelId).length,
      rateLimitRemaining: rateLimiter ? rateLimiter.getRemainingRequests() : 0,
    };
  }

  public getAllChannelStats(): ChannelStats[] {
    return Array.from(this.channels.keys())
      .map(channelId => this.getChannelStats(channelId))
      .filter((stats): stats is ChannelStats => stats !== null);
  }

  public cleanup(): void {
    // Clear all pending messages
    for (const pendingMessage of Array.from(this.pendingMessages.values())) {
      clearTimeout(pendingMessage.timeoutId);
    }
    this.pendingMessages.clear();

    // Remove all channels
    const channelIds = Array.from(this.channels.keys());
    for (const channelId of channelIds) {
      this.removeChannel(channelId);
    }

    pluginLogger.info('SecureCommunicationChannel cleanup completed');
  }
}

interface ChannelInfo {
  channelId: string;
  pluginId: string;
  worker: any;
  createdAt: number;
  messageCount: number;
  lastActivity: number;
}

interface PendingMessage {
  channelId: string;
  messageId: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
  createdAt: number;
}

interface ChannelStats {
  channelId: string;
  pluginId: string;
  messageCount: number;
  lastActivity: number;
  uptime: number;
  pendingMessages: number;
  rateLimitRemaining: number;
}

class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;

  constructor(maxRequestsPerSecond: number) {
    this.maxRequests = maxRequestsPerSecond;
  }

  allowRequest(): boolean {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Remove old requests
    this.requests = this.requests.filter(time => time > oneSecondAgo);

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getRemainingRequests(): number {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequests = this.requests.filter(time => time > oneSecondAgo);
    return Math.max(0, this.maxRequests - recentRequests.length);
  }
}