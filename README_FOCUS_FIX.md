# Roam Memo 焦点修复功能

## 问题描述

在 Roam Memo 插件的练习窗口中编辑内容时，存在一个焦点丢失的 bug：

- **问题表现**：当用户在 memo 窗口中编辑 block 内容，换行切换到新的 block 时，焦点会意外丢失
- **用户影响**：导致编辑体验中断，用户需要重新点击才能继续编辑
- **根本原因**：未知的焦点争夺机制导致 blur 事件被异常触发

## 解决方案

本项目实现了一个智能的焦点保护系统，通过拦截异常的 blur 事件来维持编辑状态：

### 核心机制

1. **事件拦截**：在捕获阶段监听 blur 事件
2. **选择性保护**：只保护 Roam 的可编辑元素
3. **自动管理**：根据 memo 窗口状态自动激活/停用
4. **完全清理**：插件卸载时彻底清理所有资源

### 实现文件

- `src/utils/roamFocusManager.ts` - 焦点管理核心类
- `src/hooks/useFocusFix.ts` - React Hook 简化使用
- `src/components/overlay/PracticeOverlay.tsx` - 集成到 memo 窗口
- `src/extension.tsx` - 插件卸载时的清理逻辑

## 技术实现

### 1. 焦点管理器 (roamFocusManager)

```typescript
// 激活焦点保护
roamFocusManager.activateFocusProtection();

// 停用焦点保护
roamFocusManager.deactivateFocusProtection();

// 强制清理（插件卸载时）
roamFocusManager.forceCleanup();
```

### 2. React Hook (useFocusFix)

```typescript
// 在 PracticeOverlay 组件中使用
useFocusFix(isOpen); // 根据窗口状态自动管理
```

### 3. 事件处理逻辑

```typescript
// 监听的可编辑元素选择器
const SELECTOR = 'input, textarea, [contenteditable="true"], .rm-block__input.roam-block';

// blur 事件处理器
document.addEventListener('blur', (event) => {
  if (event.target.matches(SELECTOR)) {
    console.log('🎯 拦截焦点丢失事件');
    event.preventDefault();    // 阻止默认失焦行为
    event.stopPropagation();  // 阻止事件冒泡
  }
}, true); // 使用捕获阶段，尽早拦截
```

## 生命周期管理

### 激活时机
- ✅ **memo 窗口打开时**：自动激活焦点保护
- ✅ **Roam 应用初始化后**：等待 DOM 结构就绪

### 停用时机
- ✅ **memo 窗口关闭时**：自动停用焦点保护
- ✅ **组件卸载时**：React 清理函数确保停用
- ✅ **插件卸载时**：强制清理所有资源

### 安全机制
- 🛡️ **重复激活保护**：避免重复添加事件监听器
- 🛡️ **动态导入**：避免服务端渲染错误
- 🛡️ **双重清理**：确保事件监听器完全移除
- 🛡️ **定时器清理**：避免内存泄漏

## 调试信息

### 激活日志
```
🎯 Roam Memo: 焦点保护机制已激活
🎯 Roam Memo: Roam 应用初始化完成，焦点保护脚本准备就绪
```

### 拦截日志
```
🎯 Roam Memo: 拦截到 Roam 块的焦点丢失事件，阻止默认行为
🎯 失焦元素: { tagName: "TEXTAREA", className: "...", id: "..." }
```

### 清理日志
```
🎯 Roam Memo: 焦点保护机制已停用
🎯 Roam Memo: 执行焦点管理器强制清理
🎯 Roam Memo: 焦点管理器清理完成
```

## 兼容性说明

### 目标元素
- ✅ 标准输入框 (`input`)
- ✅ 文本区域 (`textarea`) 
- ✅ 可编辑元素 (`[contenteditable="true"]`)
- ✅ Roam 块输入 (`.rm-block__input.roam-block`)

### 浏览器支持
- ✅ 现代浏览器的事件捕获机制
- ✅ ES6+ 动态导入功能
- ✅ Promise 异步处理

## 性能考虑

### 优化措施
- 🚀 **事件委托**：在 document 级别监听，避免重复绑定
- 🚀 **选择器缓存**：预定义选择器避免重复计算
- 🚀 **条件检查**：只在必要时触发拦截逻辑
- 🚀 **懒加载**：动态导入减少初始包大小

### 内存管理
- 🧹 **及时清理**：窗口关闭立即移除监听器
- 🧹 **定时器清理**：防止初始化检查定时器泄漏
- 🧹 **引用释放**：清理时将处理器引用设为 null

## 故障排除

### 常见问题

1. **焦点保护未生效**
   - 检查控制台是否有激活日志
   - 确认 memo 窗口已正确打开
   - 验证 Roam 应用是否完全加载

2. **清理不彻底**
   - 检查插件卸载日志
   - 手动调用 `roamFocusManager.forceCleanup()`
   - 刷新页面确保完全重置

3. **性能影响**
   - 监控控制台拦截日志频率
   - 检查是否有过度触发的情况
   - 确认清理逻辑正常工作

### 手动测试

```javascript
// 在浏览器控制台中测试
import('./utils/roamFocusManager').then(({ roamFocusManager }) => {
  console.log('焦点保护状态:', roamFocusManager.isFocusProtectionActive());
  
  // 手动激活
  roamFocusManager.activateFocusProtection();
  
  // 手动停用
  roamFocusManager.deactivateFocusProtection();
});
```

## 维护说明

### 代码结构
- **单例模式**：确保全局唯一的焦点管理器实例
- **类型安全**：TypeScript 提供完整的类型检查
- **模块化设计**：独立的管理器和 Hook，便于测试和维护

### 扩展建议
- 可以考虑添加用户配置选项来控制保护强度
- 支持更多 Roam 编辑器的特殊元素类型
- 增加更详细的性能监控和统计功能

### 交接要点
1. **理解事件机制**：blur 事件在捕获阶段的拦截原理
2. **生命周期管理**：何时激活、何时清理的完整流程
3. **调试方法**：如何通过控制台日志判断系统状态
4. **安全边界**：清理逻辑的重要性和实现方式 