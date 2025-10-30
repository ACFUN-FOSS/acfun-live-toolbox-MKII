/**
 * 读取根目录下的 package.json 文件
 * @returns 返回 package.json 的内容，若读取失败则返回 null
 */
export const getPackageJson = async (): Promise<any> => {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    try {
      // 开发环境使用动态导入
      const fs = await import('fs/promises');
      const path = await import('path');
      const packageJsonPath = path.resolve(__dirname, '../../../../package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('开发环境读取 package.json 失败:', error);
      return null;
    }
  } else {
    return {}
  }
}
