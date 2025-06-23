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
    // 从请求体获取设置数据 (已由express.json()中间件解析)
    const settings = req.body;

    // 验证请求数据
    if (!settings || typeof settings !== 'object') {
      throw new Error('Invalid settings format');
    }

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
const axios = require('axios');

// 添加JSON解析中间件
router.use(express.json());

// 直接定义带HTTP方法的路由
router.get('/config', getConfig);
router.post('/settings', updateSettings);
router.get('/status', getStatus);

// 导出Express路由器
module.exports = router;

/**
 * 初始化数据到指定主题
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
async function initializeData(req, res) {
  try {
    const { topic, data } = req.body;
    if (!topic || data === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required parameters: topic and data' });
    }

    // 发布初始数据到主程序的事件系统
    const response = await axios.post('http://localhost:3000/events/publish', {
      topic,
      data,
      publisher: 'app:template'
    });

    res.json({ success: true, result: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to initialize data', details: error.message });
  }
}

/**
 * 更新指定主题的数据
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
async function updateData(req, res) {
  try {
    const { topic, data } = req.body;
    if (!topic || data === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required parameters: topic and data' });
    }

    // 更新数据并发布到主程序的事件系统
    const response = await axios.post('http://localhost:3000/events/publish', {
      topic,
      data,
      publisher: 'app:template'
    });

    res.json({ success: true, result: response.data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update data', details: error.message });
  }
}

/**
 * 获取数据订阅URL和示例代码
 * @param {http.IncomingMessage} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
function getSubscribeInfo(req, res) {
  try {
    const { topic } = req.query;
    if (!topic) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: topic' });
    }

    // 生成订阅URL和前端示例代码
    const subscribeUrl = `http://localhost:3000/events/subscribe/${topic}`;
    const exampleCode = `
// 前端订阅数据更新示例
const eventSource = new EventSource('${subscribeUrl}');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received data update:', data);
  // 处理更新的数据
};

eventSource.onerror = (error) => {
  console.error('EventSource error:', error);
  eventSource.close();
};
    `;

    res.json({
      success: true,
      subscribeUrl,
      exampleCode: exampleCode.trim()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate subscribe info', details: error.message });
  }
}

router.post('/data/initialize', initializeData);
router.post('/data/update', updateData);
router.get('/data/subscribe', getSubscribeInfo);
