/**
 * Roam Research 焦点管理工具
 * 解决 memo 插件窗口中编辑时焦点丢失的问题
 * 
 * 问题描述：
 * 当在 memo 窗口中编辑时，如果换行切换了 block，焦点会意外丢失
 * 
 * 解决方案：
 * 通过拦截 blur 事件来防止焦点的异常丢失
 */

class RoamFocusManager {
  private static instance: RoamFocusManager;
  private blurEventHandler: ((event: Event) => void) | null = null;
  private isActive: boolean = false;
  private initCheckInterval: number | null = null;

  // Roam 可编辑元素的选择器
  private readonly ROAM_EDITABLE_SELECTOR = 'input, textarea, [contenteditable="true"], .rm-block__input.roam-block';

  private constructor() {}

  public static getInstance(): RoamFocusManager {
    if (!RoamFocusManager.instance) {
      RoamFocusManager.instance = new RoamFocusManager();
    }
    return RoamFocusManager.instance;
  }

  /**
   * 激活焦点保护机制
   * 在 memo 窗口打开时调用
   */
  public activateFocusProtection(): void {
    if (this.isActive) {
      return;
    }

    // 创建 blur 事件处理器
    this.blurEventHandler = (event: Event) => {
      const target = event.target as Element;
      
      // 检查失焦的元素是否为我们关心的可编辑块
      if (target && target.matches && target.matches(this.ROAM_EDITABLE_SELECTOR)) {
        // 阻止默认的失焦行为
        event.preventDefault();
        // 阻止事件冒泡
        event.stopPropagation();
      }
    };

    // 在捕获阶段添加事件监听器，以便尽早拦截
    document.addEventListener('blur', this.blurEventHandler, true);
    this.isActive = true;

    // 等待 Roam 应用完全加载后进行初始化检查
    this.waitForRoamInitialization();
  }

  /**
   * 停用焦点保护机制
   * 在 memo 窗口关闭时调用
   */
  public deactivateFocusProtection(): void {
    if (!this.isActive) {
      return;
    }

    // 移除事件监听器
    if (this.blurEventHandler) {
      document.removeEventListener('blur', this.blurEventHandler, true);
      this.blurEventHandler = null;
    }

    // 清理初始化检查定时器
    if (this.initCheckInterval) {
      clearInterval(this.initCheckInterval);
      this.initCheckInterval = null;
    }

    this.isActive = false;
  }

  /**
   * 检查焦点保护是否已激活
   */
  public isFocusProtectionActive(): boolean {
    return this.isActive;
  }

  /**
   * 切换焦点保护状态
   */
  public toggleFocusProtection(): void {
    if (this.isActive) {
      this.deactivateFocusProtection();
    } else {
      this.activateFocusProtection();
    }
  }

  /**
   * 等待 Roam 应用完全初始化
   * 这是一个安全检查，确保 Roam 的 DOM 结构已经就绪
   */
  private waitForRoamInitialization(): void {
    this.initCheckInterval = window.setInterval(() => {
      const roamApp = document.querySelector('.roam-app');
      const roamMain = document.querySelector('.roam-main');
      
      if (roamApp && roamMain) {
        if (this.initCheckInterval) {
          clearInterval(this.initCheckInterval);
          this.initCheckInterval = null;
        }
      }
    }, 500);
  }

  /**
   * 强制清理所有资源
   * 在插件卸载时调用，确保没有残留
   */
  public forceCleanup(): void {
    this.deactivateFocusProtection();
    
    // 额外的安全检查：确保事件监听器被完全移除
    if (this.blurEventHandler) {
      document.removeEventListener('blur', this.blurEventHandler, true);
      document.removeEventListener('blur', this.blurEventHandler, false);
      this.blurEventHandler = null;
    }
  }
}

// 导出单例实例
export const roamFocusManager = RoamFocusManager.getInstance();

// 默认导出类，用于需要的地方
export default RoamFocusManager; 