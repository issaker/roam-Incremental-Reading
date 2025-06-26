import { useEffect } from 'react';

/**
 * 用于管理Roam焦点保护的React Hook
 * 在memo窗口打开时激活焦点保护，关闭时停用
 * 
 * 解决问题：
 * - memo窗口中编辑时换行切换block导致的焦点丢失
 * 
 * @param isOpen - memo窗口是否打开
 */
export const useFocusFix = (isOpen: boolean) => {
  useEffect(() => {
    console.log('🎯 Roam Memo: useFocusFix 触发，窗口状态:', isOpen);
    
    // 最精确的 Roam 编辑块选择器，基于实际拦截到的元素特征
    // 'dont-unfocus-block' 这个类名很有意思，字面意思就是"不要失焦的块"
    // 这可能是 Roam 自己用来标识不应该失去焦点的编辑块
    const ROAM_EDITABLE_SELECTOR = 'textarea.dont-unfocus-block';
    let blurEventHandler: ((event: Event) => void) | null = null;
    
    if (isOpen) {
      // memo窗口打开时激活焦点保护
      console.log('🎯 Roam Memo: 激活焦点保护机制');
      
      // 创建 blur 事件处理器
      blurEventHandler = (event: Event) => {
        const target = event.target as Element;
        
        // 检查失焦的元素是否为我们关心的可编辑块
        if (target && target.matches && target.matches(ROAM_EDITABLE_SELECTOR)) {
          // 减少日志频率，只在开发模式下显示详细信息
          if (Math.random() < 0.1) { // 只显示10%的拦截日志
            console.log('🎯 Roam Memo: 焦点保护正在工作 (已拦截多次焦点丢失)');
          }
          
          // 阻止默认的失焦行为
          event.preventDefault();
          // 阻止事件冒泡
          event.stopPropagation();
        }
      };

      // 在捕获阶段添加事件监听器，以便尽早拦截
      document.addEventListener('blur', blurEventHandler, true);
      console.log('🎯 Roam Memo: 焦点保护事件监听器已添加');
    }

    // 清理函数：确保组件卸载或窗口关闭时移除监听器
    return () => {
      if (blurEventHandler) {
        document.removeEventListener('blur', blurEventHandler, true);
        console.log('🎯 Roam Memo: 焦点保护事件监听器已移除');
      }
    };
  }, [isOpen]);
}; 