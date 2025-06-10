import fs from 'fs';
import path from 'path';

/**
 * 读取根目录下的 package.json 文件
 * @returns 返回 package.json 的内容，若读取失败则返回 null
 */
export const  getPackageJson= async (): Promise<any> => {
  if (import.meta.env.DEV) {
    try {
      // 开发环境使用动态导入
      const packageJsonModule = await import('../../../../package.json', { assert: { type: 'json' } });
      return packageJsonModule.default;
    } catch (error) {
      console.error('开发环境读取 package.json 失败:', error);
      return null;
    }
  } else {
    return {}
  }
}
