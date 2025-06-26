# Roam Memo 层级修复功能

## 问题描述

Memo 插件的弹窗会遮挡 Roam Research 的原生 UI 元素，包括：
- 图片悬浮窗口
- 双链弹出菜单
- 其他 Blueprint UI 组件的 Popover 和 Tooltip

## 解决方案

本项目实现了一个优雅的层级管理系统，通过动态注入 CSS 样式来解决层级冲突问题。

### 核心特性

1. **自动管理**：当 Memo 窗口打开时自动注入修复样式，关闭时自动移除
2. **无副作用**：仅在 Memo 窗口打开期间生效，避免对 Roam 原生功能造成影响
3. **完整覆盖**：修复图片浮窗、双链菜单等多种 UI 元素的层级问题
4. **单例模式**：确保全局只有一个样式管理实例

### 实现文件

- `src/utils/roamZIndexManager.ts` - 层级管理工具类
- `src/components/overlay/PracticeOverlay.tsx` - 在 Memo 弹窗中集成层级管理

### 使用方法

修复功能已自动集成到 Memo 弹窗中，无需手动操作：

```typescript
// 在 PracticeOverlay 组件中
React.useEffect(() => {
  if (isOpen) {
    // 弹窗打开时，注入z-index修复
    roamZIndexManager.injectZIndexFix();
  } else {
    // 弹窗关闭时，移除z-index修复
    roamZIndexManager.removeZIndexFix();
  }

  // 清理函数：确保组件卸载时移除修复
  return () => {
    roamZIndexManager.removeZIndexFix();
  };
}, [isOpen]);
```

### 手动控制（可选）

如需在其他地方手动控制层级修复：

```typescript
import { roamZIndexManager } from '~/utils/roamZIndexManager';

// 激活修复
roamZIndexManager.injectZIndexFix();

// 移除修复
roamZIndexManager.removeZIndexFix();

// 切换状态
roamZIndexManager.toggleZIndexFix();

// 检查是否激活
const isActive = roamZIndexManager.isFixActive();
```

### CSS 修复内容

修复样式包括以下内容：

1. **Roam 图片浮层层级提升**
   ```css
   #rm-modal-portal {
     z-index: 1002 !important;
   }
   ```

2. **双链弹出菜单层级提升和宽度优化**
   ```css
   .rm-autocomplete__results {
     z-index: 1000 !important;
     width: auto !important;
     max-width: unset !important;
     min-width: 150px !important;
   }
   ```

3. **其他 Blueprint UI 组件层级提升**
   ```css
   .bp3-popover {
     z-index: 999 !important;
   }
   
   .bp3-tooltip {
     z-index: 998 !important;
   }
   ```

### 调试信息

在浏览器控制台中可以看到层级修复的状态信息：
- `🔧 Roam Memo: Z-index fix 已激活` - 修复已应用
- `🔧 Roam Memo: Z-index fix 已移除` - 修复已移除

### 技术说明

- 使用单例模式确保全局唯一性
- 通过动态创建/删除 `<style>` 标签来管理 CSS
- 使用 `!important` 确保样式优先级
- 自动清理机制防止内存泄漏 