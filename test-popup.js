// 测试 Popup 系统的脚本
import pkg from './packages/main/dist/index.cjs';
const { OverlayManager } = pkg;

async function testPopupSystem() {
  console.log('开始测试 Popup 系统...');
  
  const overlayManager = new OverlayManager();
  
  // 创建一个测试 overlay
  const testOverlay = {
    type: 'component',
    component: 'TestOverlayComponent',
    title: '测试 Popup',
    description: '这是一个测试 popup overlay',
    position: {
      x: 100,
      y: 100
    },
    size: {
      width: 400,
      height: 300
    },
    style: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
    },
    closable: true,
    modal: false,
    animation: 'fade',
    pluginId: 'test-plugin'
  };
  
  try {
    const result = await overlayManager.createOverlay(testOverlay);
    
    if (result.success) {
      console.log('✅ Overlay 创建成功:', result.overlayId);
      
      // 列出所有 overlays
      const listResult = await overlayManager.listOverlays();
      console.log('📋 当前 Overlays:', listResult.overlays);
      
      // 测试更新 overlay
      setTimeout(async () => {
        console.log('🔄 测试更新 overlay...');
        const updateResult = await overlayManager.updateOverlay(result.overlayId, {
          title: '更新后的标题',
          style: {
            backgroundColor: 'rgba(0, 123, 255, 0.95)'
          }
        });
        
        if (updateResult.success) {
          console.log('✅ Overlay 更新成功');
        } else {
          console.log('❌ Overlay 更新失败:', updateResult.error);
        }
      }, 2000);
      
      // 测试关闭 overlay
      setTimeout(async () => {
        console.log('🔒 测试关闭 overlay...');
        const closeResult = await overlayManager.closeOverlay(result.overlayId);
        
        if (closeResult.success) {
          console.log('✅ Overlay 关闭成功');
        } else {
          console.log('❌ Overlay 关闭失败:', closeResult.error);
        }
      }, 5000);
      
    } else {
      console.log('❌ Overlay 创建失败:', result.error);
    }
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testPopupSystem();