const { ipcMain } = require('electron');
const ac = require('acfundanmu');

/**
 * 封面上传API实现
 * @param {Object} params - 请求参数
 * @param {Buffer} params.cover - 封面图片Buffer数据
 * @returns {Promise<Object>} 上传结果
 */
async function uploadCover(params) {
  try {
    // 调用acfundanmu SDK的图片上传方法
    const result = await ac.uploadImage(params.cover);
    return {
      success: true,
      data: {
        coverUrl: result.url
      }
    };
  } catch (error) {
    console.error('封面上传失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 注册IPC处理函数
ipcMain.handle('live:uploadCover', async (event, params) => {
  return uploadCover(params);
});

module.exports = {
  uploadCover
};