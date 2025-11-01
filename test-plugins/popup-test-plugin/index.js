/**
 * Popup Test Plugin - 测试弹窗系统功能
 */

class PopupTestPlugin {
  constructor(api) {
    this.api = api;
    this.popupCount = 0;
    
    // 注册测试路由
    this.registerRoutes();
    
    console.log('Popup Test Plugin initialized');
  }

  registerRoutes() {
    // 基础弹窗测试
    this.api.registerHttpRoute(
      { method: 'GET', path: '/test-basic-popup' },
      async (req, res) => {
        try {
          const popupId = await this.api.popup.create({
            title: '基础弹窗测试',
            content: '这是一个基础的弹窗测试，用于验证弹窗系统的基本功能。',
            width: 400,
            height: 200,
            modal: true,
            closable: true,
            position: 'center',
            buttons: [
              { id: 'ok', text: '确定', type: 'primary' },
              { id: 'cancel', text: '取消', type: 'secondary' }
            ],
            onAction: (actionId) => {
              console.log(`Basic popup action: ${actionId}`);
            },
            onClose: () => {
              console.log('Basic popup closed');
            }
          });
          
          res.json({ success: true, popupId });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );

    // HTML 内容弹窗测试
    this.api.registerHttpRoute(
      { method: 'GET', path: '/test-html-popup' },
      async (req, res) => {
        try {
          const popupId = await this.api.popup.create({
            title: 'HTML 内容弹窗',
            content: `
              <div style="padding: 20px;">
                <h3 style="color: #1890ff; margin-bottom: 16px;">HTML 内容测试</h3>
                <p>这个弹窗包含 <strong>HTML 格式</strong>的内容。</p>
                <ul>
                  <li>支持 <em>富文本</em> 格式</li>
                  <li>支持 <code>代码</code> 高亮</li>
                  <li>支持 <a href="#" onclick="alert('链接点击')">链接</a></li>
                </ul>
                <div style="background: #f0f0f0; padding: 12px; border-radius: 4px; margin-top: 16px;">
                  <code>console.log('HTML popup test');</code>
                </div>
              </div>
            `,
            width: 500,
            height: 350,
            style: {
              backgroundColor: '#ffffff',
              borderRadius: 8,
              padding: 0
            },
            buttons: [
              { id: 'close', text: '关闭', type: 'primary' }
            ]
          });
          
          res.json({ success: true, popupId });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );

    // 多按钮弹窗测试
    this.api.registerHttpRoute(
      { method: 'GET', path: '/test-multi-button-popup' },
      async (req, res) => {
        try {
          const popupId = await this.api.popup.create({
            title: '多按钮弹窗测试',
            content: '这个弹窗包含多个不同类型的按钮，用于测试按钮交互功能。',
            width: 450,
            buttons: [
              { id: 'save', text: '保存', type: 'primary' },
              { id: 'export', text: '导出', type: 'secondary' },
              { id: 'delete', text: '删除', type: 'danger' },
              { id: 'cancel', text: '取消', type: 'secondary' }
            ],
            onAction: (actionId) => {
              console.log(`Multi-button popup action: ${actionId}`);
              
              // 模拟不同按钮的处理逻辑
              switch (actionId) {
                case 'save':
                  console.log('执行保存操作...');
                  break;
                case 'export':
                  console.log('执行导出操作...');
                  break;
                case 'delete':
                  console.log('执行删除操作...');
                  break;
                case 'cancel':
                  console.log('取消操作');
                  break;
              }
            }
          });
          
          res.json({ success: true, popupId });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );

    // 非模态弹窗测试
    this.api.registerHttpRoute(
      { method: 'GET', path: '/test-modeless-popup' },
      async (req, res) => {
        try {
          const popupId = await this.api.popup.create({
            title: '非模态弹窗',
            content: '这是一个非模态弹窗，不会阻止用户与背景内容交互。',
            width: 350,
            height: 200,
            modal: false,
            position: { x: 100, y: 100 },
            closable: true,
            resizable: true,
            style: {
              backgroundColor: '#f8f9fa',
              borderRadius: 6
            },
            buttons: [
              { id: 'minimize', text: '最小化', type: 'secondary' },
              { id: 'close', text: '关闭', type: 'primary' }
            ]
          });
          
          res.json({ success: true, popupId });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );

    // 自定义样式弹窗测试
    this.api.registerHttpRoute(
      { method: 'GET', path: '/test-styled-popup' },
      async (req, res) => {
        try {
          const popupId = await this.api.popup.create({
            title: '自定义样式弹窗',
            content: `
              <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
                <h2 style="color: #52c41a; margin-bottom: 16px;">操作成功！</h2>
                <p style="color: #666; line-height: 1.6;">
                  您的操作已经成功完成。这个弹窗展示了自定义样式的效果，
                  包括颜色、字体、间距等样式定制。
                </p>
              </div>
            `,
            width: 400,
            height: 280,
            style: {
              backgroundColor: '#f6ffed',
              borderRadius: 12,
              padding: 0
            },
            position: 'center',
            buttons: [
              { id: 'continue', text: '继续', type: 'primary' },
              { id: 'done', text: '完成', type: 'secondary' }
            ]
          });
          
          res.json({ success: true, popupId });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );

    // 位置测试弹窗
    this.api.registerHttpRoute(
      { method: 'GET', path: '/test-position-popup/:pos' },
      async (req, res) => {
        try {
          const { pos } = req.params;
          let position;
          let title;
          
          switch (pos) {
            case 'top':
              position = 'top';
              title = '顶部弹窗';
              break;
            case 'bottom':
              position = 'bottom';
              title = '底部弹窗';
              break;
            case 'custom':
              position = { x: 100, y: 100 };
              title = '自定义位置弹窗 (100, 100)';
              break;
            default:
              position = 'center';
              title = '居中弹窗';
          }
          
          const popupId = await this.api.popup.create({
            title,
            content: `这是一个位置为 ${JSON.stringify(position)} 的弹窗，用于测试不同的弹窗定位方式。`,
            width: 350,
            height: 200,
            position,
            style: {
              backgroundColor: '#f0f9ff',
              borderRadius: 16,
              padding: 24
            },
            buttons: [
              { id: 'close', text: '关闭', type: 'secondary' }
            ]
          });
          
          res.json({ success: true, popupId, position });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );

    // 批量弹窗测试
    this.api.registerHttpRoute(
      { method: 'GET', path: '/test-multiple-popups' },
      async (req, res) => {
        try {
          const popupIds = [];
          
          // 创建多个弹窗测试 z-index 管理
          for (let i = 1; i <= 3; i++) {
            const popupId = await this.api.popup.create({
              title: `弹窗 ${i}`,
              content: `这是第 ${i} 个弹窗，用于测试多弹窗的层级管理。`,
              width: 300 + i * 50,
              height: 200,
              position: { 
                x: 50 + i * 30, 
                y: 50 + i * 30 
              },
              buttons: [
                { id: 'bring-to-front', text: '置顶', type: 'secondary' },
                { id: 'close', text: '关闭', type: 'primary' }
              ],
              onAction: async (actionId) => {
                if (actionId === 'bring-to-front') {
                  await this.api.popup.bringToFront(popupId);
                }
              }
            });
            
            popupIds.push(popupId);
          }
          
          res.json({ success: true, popupIds });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      }
    );

    // 弹窗管理测试页面
    this.api.registerHttpRoute(
      { method: 'GET', path: '/popup-test' },
      async (req, res) => {
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Popup System Test</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            color: #1890ff;
            text-align: center;
            margin-bottom: 30px;
        }
        .test-section {
            margin-bottom: 30px;
            padding: 20px;
            border: 1px solid #e8e8e8;
            border-radius: 6px;
        }
        .test-section h3 {
            margin-top: 0;
            color: #333;
        }
        .test-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        button {
            padding: 8px 16px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
        }
        button:hover {
            border-color: #1890ff;
            color: #1890ff;
        }
        button.primary {
            background: #1890ff;
            color: white;
            border-color: #1890ff;
        }
        button.primary:hover {
            background: #40a9ff;
        }
        .status {
            margin-top: 15px;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 4px;
            font-family: monospace;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Popup System Test</h1>
        
        <div class="test-section">
            <h3>基础弹窗测试</h3>
            <p>测试基本的弹窗功能，包括标题、内容、按钮等。</p>
            <div class="test-buttons">
                <button onclick="testBasicPopup()">基础弹窗</button>
                <button onclick="testHtmlPopup()">HTML 内容弹窗</button>
            </div>
        </div>

        <div class="test-section">
            <h3>交互功能测试</h3>
            <p>测试弹窗的交互功能，包括多按钮、事件处理等。</p>
            <div class="test-buttons">
                <button onclick="testMultiButtonPopup()">多按钮弹窗</button>
                <button onclick="testModelessPopup()">非模态弹窗</button>
            </div>
        </div>

        <div class="test-section">
            <h3>样式和布局测试</h3>
            <p>测试弹窗的样式定制和布局功能。</p>
            <div class="test-buttons">
                <button onclick="testStyledPopup()">自定义样式弹窗</button>
                <button onclick="testMultiplePopups()">多弹窗层级测试</button>
            </div>
        </div>

        <div class="test-section">
            <h3>位置测试</h3>
            <p>测试弹窗的不同定位方式。</p>
            <div class="test-buttons">
                <button onclick="testPositionPopup('center')">居中弹窗</button>
                <button onclick="testPositionPopup('top')">顶部弹窗</button>
                <button onclick="testPositionPopup('bottom')">底部弹窗</button>
                <button onclick="testPositionPopup('custom')">自定义位置弹窗</button>
            </div>
        </div>

        <div class="status" id="status">
            准备就绪 - 点击上方按钮开始测试
        </div>
    </div>

    <script>
        function updateStatus(message) {
            document.getElementById('status').textContent = new Date().toLocaleTimeString() + ' - ' + message;
        }

        async function testBasicPopup() {
            try {
                updateStatus('创建基础弹窗...');
                const response = await fetch('/plugins/popup-test-plugin/test-basic-popup');
                const result = await response.json();
                if (result.success) {
                    updateStatus('基础弹窗创建成功: ' + result.popupId);
                } else {
                    updateStatus('创建失败: ' + result.error);
                }
            } catch (error) {
                updateStatus('请求失败: ' + error.message);
            }
        }

        async function testHtmlPopup() {
            try {
                updateStatus('创建 HTML 内容弹窗...');
                const response = await fetch('/plugins/popup-test-plugin/test-html-popup');
                const result = await response.json();
                if (result.success) {
                    updateStatus('HTML 弹窗创建成功: ' + result.popupId);
                } else {
                    updateStatus('创建失败: ' + result.error);
                }
            } catch (error) {
                updateStatus('请求失败: ' + error.message);
            }
        }

        async function testMultiButtonPopup() {
            try {
                updateStatus('创建多按钮弹窗...');
                const response = await fetch('/plugins/popup-test-plugin/test-multi-button-popup');
                const result = await response.json();
                if (result.success) {
                    updateStatus('多按钮弹窗创建成功: ' + result.popupId);
                } else {
                    updateStatus('创建失败: ' + result.error);
                }
            } catch (error) {
                updateStatus('请求失败: ' + error.message);
            }
        }

        async function testModelessPopup() {
            try {
                updateStatus('创建非模态弹窗...');
                const response = await fetch('/plugins/popup-test-plugin/test-modeless-popup');
                const result = await response.json();
                if (result.success) {
                    updateStatus('非模态弹窗创建成功: ' + result.popupId);
                } else {
                    updateStatus('创建失败: ' + result.error);
                }
            } catch (error) {
                updateStatus('请求失败: ' + error.message);
            }
        }

        async function testStyledPopup() {
            try {
                updateStatus('创建自定义样式弹窗...');
                const response = await fetch('/plugins/popup-test-plugin/test-styled-popup');
                const result = await response.json();
                if (result.success) {
                    updateStatus('样式弹窗创建成功: ' + result.popupId);
                } else {
                    updateStatus('创建失败: ' + result.error);
                }
            } catch (error) {
                updateStatus('请求失败: ' + error.message);
            }
        }

        async function testMultiplePopups() {
            try {
                updateStatus('创建多个弹窗...');
                const response = await fetch('/plugins/popup-test-plugin/test-multiple-popups');
                const result = await response.json();
                if (result.success) {
                    updateStatus('多弹窗创建成功: ' + result.popupIds.join(', '));
                } else {
                    updateStatus('创建失败: ' + result.error);
                }
            } catch (error) {
                updateStatus('请求失败: ' + error.message);
            }
        }

        async function testPositionPopup(position) {
            try {
                updateStatus(`创建${position}位置弹窗...`);
                const response = await fetch(`/plugins/popup-test-plugin/test-position-popup/${position}`);
                const result = await response.json();
                if (result.success) {
                    updateStatus(`${position}位置弹窗创建成功: ${result.popupId}, 位置: ${JSON.stringify(result.position)}`);
                } else {
                    updateStatus('创建失败: ' + result.error);
                }
            } catch (error) {
                updateStatus('请求失败: ' + error.message);
            }
        }

        // 页面加载完成
        updateStatus('Popup 测试页面已加载，可以开始测试');
    </script>
</body>
</html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      }
    );
  }
}

// 导出插件类
module.exports = PopupTestPlugin;