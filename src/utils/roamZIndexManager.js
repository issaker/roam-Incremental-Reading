/**
 * Roam Research UI 层级管理工具 (JavaScript 版本)
 * 解决 memo 插件遮挡 Roam 原生 UI 元素的问题
 */

class RoamZIndexManager {
  constructor() {
    this.styleElement = null;
    this.STYLE_ID = 'roam-memo-zindex-fix';
  }

  /**
   * 注入CSS样式来提升Roam UI元素的层级
   */
  injectZIndexFix() {
    // 如果已经注入过，直接返回
    if (this.styleElement) {
      return;
    }

    // 创建样式元素
    this.styleElement = document.createElement('style');
    this.styleElement.id = this.STYLE_ID;
    this.styleElement.type = 'text/css';

    // 定义CSS规则
    const cssRules = `
      /*
       * Roam Research 图片悬浮窗口的层级提升
       * 解决被 Memo 插件遮挡的问题
       */
      
      /* 提升 Roam 图片浮层的 Z-index */
      #rm-modal-portal {
        z-index: 1002 !important; /* Roam 图片浮层整体的 z-index，最高 */
      }
      
      #rm-modal-portal > div > div > div.bp3-dialog-container.bp3-overlay-content > div {
        z-index: 1001 !important; /* 确保图片实际内容也高 */
      }
      
      /* 提升 Roam 双链弹出菜单的 Z-index */
      .rm-autocomplete__results {
        z-index: 1000 !important; /* 使用一个非常高的值，确保显示在所有其他元素之上 */
        width: auto !important; /* 调整为自适应宽度 */
        max-width: unset !important; /* 取消最大宽度限制 */
        min-width: 150px !important; /* 设置最小宽度，防止过窄 */
      }
      
             /* 提升其他可能被遮挡的 Roam UI 元素 */
       .bp3-popover {
         z-index: 999 !important;
       }
       
       .bp3-tooltip {
         z-index: 998 !important;
       }
    `;

    this.styleElement.textContent = cssRules;

    // 将样式元素添加到文档头部
    document.head.appendChild(this.styleElement);

    console.log('🔧 Roam Memo: Z-index fix 已激活');
  }

  /**
   * 移除CSS样式，恢复原始层级
   */
  removeZIndexFix() {
    if (this.styleElement) {
      document.head.removeChild(this.styleElement);
      this.styleElement = null;
      console.log('🔧 Roam Memo: Z-index fix 已移除');
    }
  }

  /**
   * 检查样式是否已注入
   */
  isFixActive() {
    return this.styleElement !== null;
  }

  /**
   * 切换样式注入状态
   */
  toggleZIndexFix() {
    if (this.isFixActive()) {
      this.removeZIndexFix();
    } else {
      this.injectZIndexFix();
    }
  }
}

// 创建单例实例
const roamZIndexManagerInstance = new RoamZIndexManager();

// 导出单例实例
export const roamZIndexManager = roamZIndexManagerInstance;

// 默认导出类，用于需要的地方
export default RoamZIndexManager; 