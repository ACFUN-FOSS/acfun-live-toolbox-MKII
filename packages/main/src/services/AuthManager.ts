import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// 在开发环境中容错加载 acfunlive-http-api：优先尝试 dist，失败则回退到 src TS 文件。
async function loadAuthDeps(): Promise<{ AuthService: any; HttpClient: any }> {
  const distAuthPath = 'acfunlive-http-api/dist/services/AuthService';
  const distHttpPath = 'acfunlive-http-api/dist/core/HttpClient';
  const srcAuthPath = 'acfunlive-http-api/src/services/AuthService';
  const srcHttpPath = 'acfunlive-http-api/src/core/HttpClient';

  try {
    const modAuth = await import(distAuthPath as any);
    const modHttp = await import(distHttpPath as any);
    return { AuthService: (modAuth as any).AuthService, HttpClient: (modHttp as any).HttpClient };
  } catch (err) {
    try {
      const modAuth = await import(srcAuthPath as any);
      const modHttp = await import(srcHttpPath as any);
      return { AuthService: (modAuth as any).AuthService, HttpClient: (modHttp as any).HttpClient };
    } catch (fallbackErr) {
      console.warn('[AuthManager] Failed to load acfunlive-http-api from dist and src:', fallbackErr);
      throw new Error('acfunlive-http-api is not available. Please build or install it.');
    }
  }
}

export interface QrLoginResult {
  qrCodeDataUrl: string;
  expiresIn: number;
}

export interface LoginStatus {
  success: boolean;
  error?: string;
  userId?: string;
  expiresAt?: number;
}

export class AuthManager {
  private readonly secretsPath: string;
  private authService: any;

  constructor() {
    // 延迟加载依赖，避免应用启动时因未构建的依赖导致崩溃
    this.authService = null as any;
    this.secretsPath = path.join(app.getPath('userData'), 'secrets.json');
  }

  private async ensureAuthService(): Promise<void> {
    if (!this.authService) {
      const { AuthService, HttpClient } = await loadAuthDeps();
      const httpClient = new HttpClient({ baseUrl: '', timeout: 30000 });
      this.authService = new AuthService(httpClient);
    }
  }

  async startQrLogin(): Promise<QrLoginResult> {
    await this.ensureAuthService();
    const qrResult = await this.authService.qrLogin();
    if (!qrResult?.success || !qrResult?.data) {
      throw new Error(qrResult?.error || 'Failed to initiate QR login');
    }
    const { qrCode, expiresIn } = qrResult.data;
    const qrCodeDataUrl = `data:image/png;base64,${qrCode}`;
    return { qrCodeDataUrl, expiresIn };
  }

  async checkQrLoginStatus(): Promise<LoginStatus> {
    await this.ensureAuthService();
    const status = await this.authService.checkQrLoginStatus();
    if (status?.success && status?.data) {
      // Persist token securely in main process only
      this.saveToken(status.data);
      return {
        success: true,
        userId: status.data.userId,
        expiresAt: status.data.expiresAt,
      };
    }
    return { success: false, error: status?.error || 'Unknown error' };
  }

  async logout(): Promise<void> {
    try {
      if (fs.existsSync(this.secretsPath)) {
        const obj = JSON.parse(fs.readFileSync(this.secretsPath, 'utf-8'));
        delete obj.acfun_token;
        delete obj.refresh_token;
        delete obj.userId;
        fs.writeFileSync(this.secretsPath, JSON.stringify(obj, null, 2));
      }
    } catch {}
  }

  private saveToken(data: { token: string; userId: string; expiresAt: number; refreshToken?: string }) {
    try {
      const existing = fs.existsSync(this.secretsPath)
        ? JSON.parse(fs.readFileSync(this.secretsPath, 'utf-8'))
        : {};
      const next = {
        ...existing,
        acfun_token: data.token,
        refresh_token: data.refreshToken,
        userId: data.userId,
        token_expires_at: data.expiresAt,
        updated_at: Date.now(),
      };
      fs.mkdirSync(path.dirname(this.secretsPath), { recursive: true });
      fs.writeFileSync(this.secretsPath, JSON.stringify(next, null, 2));
    } catch (err) {
      // Do not expose sensitive details to renderer
      console.error('[AuthManager] Failed to persist token:', err);
    }
  }
}