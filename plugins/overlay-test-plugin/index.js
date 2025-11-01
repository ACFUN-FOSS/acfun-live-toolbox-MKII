// Overlay测试插件
class OverlayTestPlugin {
  constructor() {
    this.overlayIds = new Set();
    this.testCounter = 0;
  }

  async onLoad() {
    console.log('Overlay测试插件已加载');
    
    // 添加测试按钮到插件UI
    this.addTestButtons();
  }

  addTestButtons() {
    const container = document.createElement('div');
    container.style.cssText = `
      padding: 20px;
      background: #f5f5f5;
      border-radius: 8px;
      margin: 10px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Overlay系统测试';
    container.appendChild(title);

    // 创建文本overlay按钮
    const textBtn = this.createButton('创建文本Overlay', () => this.createTextOverlay());
    container.appendChild(textBtn);

    // 创建HTML overlay按钮
    const htmlBtn = this.createButton('创建HTML Overlay', () => this.createHtmlOverlay());
    container.appendChild(htmlBtn);

    // 创建组件overlay按钮
    const componentBtn = this.createButton('创建组件Overlay', () => this.createComponentOverlay());
    container.appendChild(componentBtn);

    // 列出所有overlay按钮
    const listBtn = this.createButton('列出所有Overlay', () => this.listOverlays());
    container.appendChild(listBtn);

    // 清除所有overlay按钮
    const clearBtn = this.createButton('清除所有Overlay', () => this.clearAllOverlays());
    container.appendChild(clearBtn);

    // 将容器添加到插件区域
    const pluginArea = document.querySelector('#plugin-content') || document.body;
    pluginArea.appendChild(container);
  }

  createButton(text, onClick) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      margin: 5px;
      padding: 8px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    button.addEventListener('click', onClick);
    return button;
  }

  async createTextOverlay() {
    try {
      this.testCounter++;
      const result = await window.electronApi.overlay.create({
        type: 'text',
        content: `这是第${this.testCounter}个文本overlay测试`,
        position: { x: 100 + (this.testCounter * 20), y: 100 + (this.testCounter * 20) },
        size: { width: 300, height: 100 },
        style: {
          backgroundColor: 'rgba(0, 123, 255, 0.9)',
          color: 'white',
          fontSize: '16px',
          padding: '10px',
          borderRadius: '8px'
        },
        pluginId: 'overlay-test-plugin'
      });
      
      this.overlayIds.add(result.overlayId);
      console.log('文本overlay创建成功:', result);
    } catch (error) {
      console.error('创建文本overlay失败:', error);
    }
  }

  async createHtmlOverlay() {
    try {
      this.testCounter++;
      const htmlContent = `
        <div style="background: linear-gradient(45deg, #ff6b6b, #4ecdc4); padding: 20px; border-radius: 10px; color: white; text-align: center;">
          <h2>HTML Overlay #${this.testCounter}</h2>
          <p>这是一个HTML内容的overlay</p>
          <button onclick="window.overlayApi.action('test-action', {message: 'Hello from overlay!'})">
            点击测试
          </button>
        </div>
      `;

      const result = await window.electronApi.overlay.create({
        type: 'html',
        content: htmlContent,
        position: { x: 200 + (this.testCounter * 30), y: 150 + (this.testCounter * 30) },
        size: { width: 350, height: 200 },
        pluginId: 'overlay-test-plugin'
      });
      
      this.overlayIds.add(result.overlayId);
      console.log('HTML overlay创建成功:', result);
    } catch (error) {
      console.error('创建HTML overlay失败:', error);
    }
  }

  async createComponentOverlay() {
    try {
      this.testCounter++;
      const result = await window.electronApi.overlay.create({
        type: 'component',
        content: 'TestOverlayComponent',
        props: {
          title: `组件Overlay #${this.testCounter}`,
          message: '这是一个Vue组件overlay',
          counter: this.testCounter
        },
        position: { x: 300 + (this.testCounter * 40), y: 200 + (this.testCounter * 40) },
        size: { width: 400, height: 250 },
        style: {
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        },
        pluginId: 'overlay-test-plugin'
      });
      
      this.overlayIds.add(result.overlayId);
      console.log('组件overlay创建成功:', result);
    } catch (error) {
      console.error('创建组件overlay失败:', error);
    }
  }

  async listOverlays() {
    try {
      const result = await window.electronApi.overlay.list();
      console.log('当前所有overlay:', result);
      
      // 显示overlay列表
      const overlayList = result.overlays.map(overlay => 
        `ID: ${overlay.id}, 类型: ${overlay.type}, 插件: ${overlay.pluginId}`
      ).join('\n');
      
      alert(`当前overlay列表:\n${overlayList || '无overlay'}`);
    } catch (error) {
      console.error('获取overlay列表失败:', error);
    }
  }

  async clearAllOverlays() {
    try {
      for (const overlayId of this.overlayIds) {
        await window.electronApi.overlay.close(overlayId);
      }
      this.overlayIds.clear();
      console.log('所有测试overlay已清除');
    } catch (error) {
      console.error('清除overlay失败:', error);
    }
  }

  async onAction(action, data) {
    console.log('收到overlay动作:', action, data);
    
    if (action === 'test-action') {
      alert(`收到来自overlay的消息: ${data.message}`);
    }
  }

  async onUnload() {
    // 清理所有创建的overlay
    await this.clearAllOverlays();
    console.log('Overlay测试插件已卸载');
  }
}

// 导出插件类
window.OverlayTestPlugin = OverlayTestPlugin;