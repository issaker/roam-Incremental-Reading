import { useEffect } from 'react';

/**
 * 用于管理Roam UI元素层级的React Hook
 * 在memo窗口打开时注入CSS修复，关闭时移除
 */
export const useZIndexFix = (isOpen: boolean) => {
  useEffect(() => {
    const STYLE_ID = 'roam-memo-zindex-fix';
    
    if (isOpen) {
      // 检查是否已经存在样式
      if (document.getElementById(STYLE_ID)) {
        return;
      }

      // 创建样式元素
      const styleElement = document.createElement('style');
      styleElement.id = STYLE_ID;
      styleElement.type = 'text/css';

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

      styleElement.textContent = cssRules;
      document.head.appendChild(styleElement);
      
    } else {
      // 移除样式
      const existingStyle = document.getElementById(STYLE_ID);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    }

    // 清理函数：确保组件卸载时移除修复
    return () => {
      const existingStyle = document.getElementById(STYLE_ID);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, [isOpen]);
}; 