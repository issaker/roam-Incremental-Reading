# Roam Memo 插件修复与增强项目总结

## 项目背景
用户有一个 Roam Memo 插件存在多个问题，需要进行修复和优化，同时新增了卡片优先级管理功能。

## 主要功能与解决方案

### 1. 层级遮挡问题修复 🔧
**问题**：Memo 插件窗口遮挡 Roam 原生 UI 元素
- Roam 图片悬浮窗口被遮挡
- 双链弹出菜单被遮挡
- 其他 Blueprint UI 组件层级问题

**解决方案**：动态 CSS 层级管理
- 创建了 `src/utils/roamZIndexManager.ts` 和 `.js` 版本
- 创建了 `src/hooks/useZIndexFix.ts` React Hook
- 在 `PracticeOverlay.tsx` 中集成：`useZIndexFix(isOpen)`
- CSS 修复内容：
  - `#rm-modal-portal { z-index: 1002 !important }`
  - `.rm-autocomplete__results { z-index: 1000 !important; width: auto !important }`
  - `.bp3-popover { z-index: 999 !important }`
  - `.bp3-tooltip { z-index: 998 !important }`
- 用户要求移除半透明背景隐藏功能以保持点击外部关闭的交互

### 2. 焦点丢失问题修复 🎯
**问题**：在 memo 窗口中编辑时，换行切换 block 导致焦点丢失

**解决方案演进**：
1. 最初创建了复杂的 `roamFocusManager` 单例类
2. 发现动态导入问题，改为直接在 `useFocusFix.ts` Hook 中实现
3. 基于用户提供的 JS 脚本，实现 blur 事件拦截：
```typescript
const ROAM_EDITABLE_SELECTOR = 'textarea.dont-unfocus-block';
document.addEventListener('blur', (event) => {
  if (target.matches(ROAM_EDITABLE_SELECTOR)) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);
```

**成功验证**：用户提供控制台日志显示功能正常工作，成功拦截了多次焦点丢失事件。

**最终优化**：根据实际拦截到的元素特征，将选择器精确化为 `textarea.dont-unfocus-block`，这个类名语义上就是"不要失焦的块"，更加精确和安全。

### 3. 用户体验改进 ✨
**问题**：面包屑信息默认关闭
**解决方案**：在 `PracticeOverlay.tsx` 中将 `useState(false)` 改为 `useState(true)`

### 4. 插件加载问题 🛠️
**问题**：用户遇到 "extension does not have an extension.js" 错误
**解决方案**：
- 运行 `npm install` 安装依赖
- 运行 `npm run build` 构建项目
- 生成了 3MB 的 `extension.js` 文件

### 5. 卡片优先级功能 🎯 (新增功能)
**需求**：用户希望为每张卡片设置优先级（0-100），优先级只影响队列顺序，不影响SRS算法

**核心实现**：
- **数据模型扩展**：在 `Session` 类型中添加 `priority?: number` 字段，默认值 70
- **排序逻辑重构**：修改 `getDueCardUids()` 函数，用优先级排序完全取代原有的 nextDueDate 排序，保留随机洗牌作为二次排序
- **UI组件新增**：在 Footer 组件中添加优先级滑块，仅在有卡片且未完成时显示
- **状态管理**：在 `PracticeOverlay` 中维护优先级修改的本地状态，支持批量管理
- **智能保存**：创建 `savePriorityData()` 和 `bulkSavePriorityData()` 函数，在窗口关闭时批量保存
- **向后兼容**：现有卡片自动获得默认优先级 70，完全兼容现有数据

**功能特点**：
- 🔢 优先级范围：0-100，默认 70
- 🎛️ 中文界面：优雅的滑块控制
- 💾 延迟保存：关闭时批量保存，提升性能
- 📊 排序优化：高优先级卡片优先出现
- 🔄 完全兼容：不影响现有功能和数据

**数据存储格式**：
```
- [[June 20th, 2025]] 🔵
    - nextDueDate:: [[June 21st, 2025]]
    - eFactor:: 2.5
    - interval:: 1
    - repetitions:: 1
    - grade:: 4
    - reviewMode:: SPACED_INTERVAL
    - priority:: 75
```

## 技术实现架构

### 文件结构
```
src/
├── utils/
│   ├── roamZIndexManager.ts     # 层级管理核心类
│   ├── roamZIndexManager.js     # JavaScript 备用版本
│   └── roamFocusManager.ts      # 焦点管理核心类（最终未使用）
├── hooks/
│   ├── useZIndexFix.ts          # 层级修复 Hook
│   └── useFocusFix.ts           # 焦点修复 Hook（最终实现）
├── components/overlay/
│   ├── PracticeOverlay.tsx      # 集成所有修复功能 + 优先级状态管理
│   └── Footer.tsx               # 新增优先级滑块组件
├── queries/
│   ├── today.ts                 # 修改排序逻辑（优先级排序）
│   └── save.ts                  # 新增优先级保存功能
├── models/
│   └── session.ts               # 扩展 Session 类型支持优先级
└── extension.tsx                # 插件入口，处理卸载清理
```

### 设计模式
- 单例模式（层级管理器）
- React Hook 模式（简化组件使用）
- 生命周期管理（与组件状态同步）
- 模块化设计（独立功能模块）
- 批量处理模式（优先级保存优化）

### 生命周期管理
- **激活时机**：memo 窗口打开时自动激活所有修复
- **停用时机**：memo 窗口关闭时自动清理
- **强制清理**：插件卸载时在 `extension.tsx` 中清理所有资源
- **数据保存**：窗口关闭时批量保存优先级修改

## 配置修改
- 更新了 `tsconfig.json`：`target: "es2017"`, 添加了 `lib: ["es2017", "dom", "dom.iterable"]`

## 文档创建
- `README_ZINDEX_FIX.md` - 层级修复功能详细说明
- `README_FOCUS_FIX.md` - 焦点修复功能详细说明  
- `README_PRIORITY_FEATURE.md` - 优先级功能详细说明
- `PATCH_SUMMARY.md` - 所有修复功能的总结概览

## 使用方式

### 自动模式（默认）
所有功能已自动集成到 memo 窗口中：
1. 打开 memo 窗口 → 自动激活所有修复和功能
2. 调整优先级 → 实时生效，关闭时自动保存
3. 关闭 memo 窗口 → 自动清理所有修复，保存数据
4. 卸载插件 → 强制清理所有资源

### 优先级功能使用
1. **设置优先级**：在学习界面底部用滑块调整当前卡片优先级
2. **保存生效**：完成学习或关闭窗口时自动保存所有修改
3. **排序影响**：下次学习时，卡片按优先级排序（高优先级先出现）
4. **洗牌选项**：设置中的"洗牌卡片"依然有效，作为优先级排序后的二次洗牌

## 调试信息

### 控制台日志标识
- **🔧 层级修复**：`Roam Memo: Z-index fix 已激活/已移除`
- **🎯 焦点修复**：`Roam Memo: 焦点保护事件监听器已添加/已移除`
- **🎯 焦点拦截**：`Roam Memo: 拦截到 Roam 块的焦点丢失事件`
- **💾 优先级保存**：控制台显示批量保存结果

## 最终状态
所有四个功能都成功实现并验证：
1. **层级修复** ✅：`🔧 Roam Memo: Z-index fix 已激活`
2. **焦点修复** ✅：`🎯 Roam Memo: 焦点保护事件监听器已添加`，成功拦截焦点丢失事件
3. **面包屑默认显示** ✅：改善用户体验
4. **卡片优先级功能** ✅：完整的优先级管理系统，用户可自定义卡片学习顺序

用户现在拥有一个功能完整、性能优化、用户体验优秀的 Roam Memo 插件，支持：
- 🔧 完美的UI层级管理
- 🎯 无焦点丢失的编辑体验  
- 🎛️ 智能的卡片优先级控制
- 💾 高性能的数据保存机制
- 🔄 完全的向后兼容性

## 部署说明

### 构建要求
1. 运行 `npm install` 安装依赖
2. 运行 `npm run build` 构建项目
3. 确认生成 `extension.js` 文件 (约 3MB)

### 安装到 Roam
1. 在 Roam 中进入 `{{[[roam/js]]}}` 页面
2. 选择 "Add Extension" → "Local Extension"
3. 选择整个 `roam-memo-main` 文件夹
4. 插件加载后所有功能自动生效

### 验证安装
- 打开 memo 窗口，检查控制台是否有激活日志
- 测试图片浮窗是否不被遮挡
- 测试双链菜单是否正常显示
- 测试编辑时焦点是否保持
- 测试优先级滑块是否正常显示和工作
- 验证优先级排序是否生效

---

**注意**：所有功能都设计为非侵入性的，不会对 Roam Research 的原生功能造成任何负面影响。插件卸载后，所有修改都会被完全清理，优先级数据保留在 Roam 页面中。 