// 小程序后端API接口实现

/**
 * 获取应用配置信息
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
async function getConfig(req, res) {
  try {
    const config = require("./config.json");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        data: config,
      })
    );
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: false,
        error: "Failed to load configuration",
      })
    );
  }
}

/**
 * 更新应用设置
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
async function updateSettings(req, res) {
  try {
    // 读取请求体
    const body = [];
    for await (const chunk of req) {
      body.push(chunk);
    }
    const settings = JSON.parse(Buffer.concat(body).toString());

    // 在实际应用中，这里应该更新配置文件
    // 为简化示例，仅返回成功信息
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        message: "Settings updated successfully",
        updated: settings,
      })
    );
  } catch (error) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: false,
        error: "Invalid request or settings",
      })
    );
  }
}

/**
 * 获取应用状态
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
function getStatus(req, res) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      success: true,
      status: "running",
      timestamp: new Date().toISOString(),
    })
  );
}

const express = require('express');
const router = express.Router();

// 直接定义带HTTP方法的路由
router.get('/config', getConfig);
router.post('/settings', updateSettings);
router.get('/status', getStatus);

// 导出Express路由器
module.exports = router;
