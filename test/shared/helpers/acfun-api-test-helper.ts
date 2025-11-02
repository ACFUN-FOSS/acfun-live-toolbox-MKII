import { AcFunLiveApi, createApi } from 'acfunlive-http-api';
import fs from 'fs';
import path from 'path';

interface TokenData {
  token: string;
  expiresAt: number;
}

export class AcFunApiTestHelper {
  private api: AcFunLiveApi;
  private cachedToken: TokenData | null = null;
  private tokenPath: string;
  private silentMode: boolean = false; // 添加静默模式控制

  constructor() {
    this.api = createApi();
    this.tokenPath = path.join(__dirname, '../../.test-token.json');
  }

  /**
   * 检查token是否有效（距离过期时间超过5分钟）
   */
  /**
   * 设置静默模式
   */
  setSilentMode(silent: boolean): void {
    this.silentMode = silent;
  }

  /**
   * 安全的console.log，只在非静默模式下输出
   */
  private safeLog(...args: any[]): void {
    if (!this.silentMode) {
      console.log(...args);
    }
  }

  private isTokenValid(tokenData: TokenData): boolean {
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5分钟缓冲时间
    return tokenData.expiresAt > (now + bufferTime);
  }

  /**
   * 强制刷新token
   */
  async refreshToken(): Promise<string> {
    this.cachedToken = null;
    if (fs.existsSync(this.tokenPath)) {
      fs.unlinkSync(this.tokenPath);
    }
    return this.getValidToken();
  }

  /**
   * 获取token状态信息
   */
  getTokenStatus(): { isValid: boolean; expiresAt?: number; timeUntilExpiry?: number } {
    if (!this.cachedToken) {
      return { isValid: false };
    }
    
    const now = Date.now();
    const isValid = this.isTokenValid(this.cachedToken);
    const timeUntilExpiry = this.cachedToken.expiresAt - now;
    
    return {
      isValid,
      expiresAt: this.cachedToken.expiresAt,
      timeUntilExpiry
    };
  }

  /**
   * 获取有效的token
   */
  async getValidToken(): Promise<string> {
    // 检查缓存的token
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      this.safeLog('✅ 使用缓存的有效token');
      return this.cachedToken.token;
    }

    // 尝试从文件加载token
    const fileToken = this.loadTokenFromFile();
    if (fileToken && this.isTokenValid(fileToken)) {
      this.safeLog('✅ 从文件加载有效token');
      this.cachedToken = fileToken;
      return fileToken.token;
    }

    // 如果没有有效token，提示用户进行登录
    this.safeLog('\n🔑 需要获取新的认证token');
    this.safeLog('📋 请按照以下步骤操作：');
    this.safeLog('   1. 确保您有AcFun账号并已安装手机客户端');
    this.safeLog('   2. 准备好手机扫描二维码');
    this.safeLog('   3. 按任意键继续...\n');
    
    return await this.performQRLogin();
  }

  /**
   * 执行二维码登录
   */
  private async performQRLogin(): Promise<string> {
    // 二维码信息始终显示，不受静默模式影响
    console.log('\n' + '='.repeat(80));
    console.log('🔄 开始二维码登录流程...');
    
    // 获取二维码
    const qrResult = await this.api.auth.qrLogin();
    
    if (!qrResult.success || !qrResult.data) {
      throw new Error(`获取二维码失败: ${qrResult.error}`);
    }

    console.log('\n📱 请使用AcFun手机客户端扫描二维码登录');
    console.log('二维码URL:', `data:image/png;base64,${qrResult.data.qrCode}`);
    console.log('\n' + '='.repeat(80) + '\n');

    // 轮询检查登录状态
    const maxAttempts = 60; // 最多等待5分钟
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒

      const statusResult = await this.api.auth.checkQrLoginStatus();
      if (statusResult.success && statusResult.data?.token) {
        console.log('✅ 登录成功!');
        
        // 保存token到缓存和文件
        const tokenData: TokenData = {
          token: statusResult.data.token,
          expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24小时后过期
        };
        
        this.saveTokenToFile(tokenData);
        this.cachedToken = tokenData;
        return statusResult.data.token;
      }

      // 等待信息使用安全日志输出
      this.safeLog(`⏳ 等待扫码登录... (${i + 1}/${maxAttempts})`);
    }

    throw new Error('二维码登录超时，请重试');
  }

  /**
   * 从文件加载token
   */
  private loadTokenFromFile(): TokenData | null {
    try {
      if (!fs.existsSync(this.tokenPath)) {
        return null;
      }

      const data = fs.readFileSync(this.tokenPath, 'utf-8');
      const tokenData = JSON.parse(data) as TokenData;
      
      return tokenData;
    } catch (error) {
      console.warn('加载token文件失败:', error);
      return null;
    }
  }

  /**
   * 保存token到文件
   */
  private saveTokenToFile(tokenData: TokenData): void {
    try {
      const dir = path.dirname(this.tokenPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.tokenPath, JSON.stringify(tokenData, null, 2));
      console.log('Token已保存到文件');
    } catch (error) {
      console.warn('保存token文件失败:', error);
    }
  }

  /**
   * 获取热门直播间信息
   */
  async getHotLiveRoom(): Promise<{ liveId: string; liverUID: number; title: string; liverName: string }> {
    console.log('🔍 正在获取热门直播间信息...');
    
    const token = await this.getValidToken();
    this.api.setAuthToken(token);

    const result = await this.api.live.getHotLiveRooms();
    if (!result.success || !result.data || result.data.length === 0) {
      throw new Error('获取热门直播间失败');
    }

    const room = result.data[0];
    console.log(`✅ 获取到直播间: ${room.title} (主播: ${room.liverName})`);
    
    return {
      liveId: room.liveId,
      liverUID: room.liverUID,
      title: room.title,
      liverName: room.liverName
    };
  }

  /**
   * 获取测试用户ID
   */
  getTestUserId(): string {
    return '123456789'; // 默认测试用户ID
  }
}

export const acfunApiTestHelper = new AcFunApiTestHelper();