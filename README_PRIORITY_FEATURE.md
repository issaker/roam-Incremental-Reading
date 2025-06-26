# 🎯 Roam Memo 卡片优先级功能

## 📋 功能概述

这个功能为 Roam Memo 插件添加了卡片优先级管理，允许用户为每张卡片设置 0-100 的优先级（100 为最高优先级，默认为 70）。优先级仅影响卡片队列的排序，不影响间隔重复算法。

## ✨ 主要特性

- **🔢 优先级范围**: 0-100，默认 70
- **🎛️ 友好UI**: 底部滑块控制，只在学习界面显示
- **💾 智能保存**: 关闭窗口时批量保存，提升性能
- **📊 排序优化**: 优先级排序取代原有按时间排序，保留随机洗牌功能
- **🔄 兼容性**: 现有卡片自动获得默认优先级

## 🏗️ 技术实现

### 数据模型扩展
```typescript
// src/models/session.ts
export type Session = {
  // ... 现有字段
  priority?: number; // 0-100, 100 = highest priority, default 70
} & SessionCommon;
```

### 核心文件修改

#### 1. 排序逻辑 (`src/queries/today.ts`)
- 修改 `getDueCardUids()` 函数
- 用优先级排序替代 nextDueDate 排序
- 保持随机洗牌作为二次排序

#### 2. UI组件 (`src/components/overlay/`)
- 新增独立的 `PrioritySlider.tsx` 组件
- 放置在Footer按钮下方，不破坏原有按钮布局
- 中文界面，优雅的滑块设计（0-100，步长5）
- 只在有卡片且未完成时显示
- 独特的背景色和边框设计，视觉上与按钮区分开

#### 3. 状态管理 (`src/components/overlay/PracticeOverlay.tsx`)
- 新增 `priorityChanges` 状态跟踪修改
- 实现优先级变更的本地管理
- 窗口关闭时触发批量保存

#### 4. 数据保存 (`src/queries/save.ts`)
- 新增 `savePriorityData()` 函数
- 新增 `bulkSavePriorityData()` 批量保存
- 智能更新已有优先级或创建新字段

### 数据存储格式
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

## 🎮 使用方法

1. **设置优先级**: 在学习界面底部用滑块调整当前卡片优先级
2. **保存生效**: 完成学习或关闭窗口时自动保存所有修改
3. **排序影响**: 下次学习时，卡片按优先级排序（高优先级先出现）
4. **洗牌选项**: 设置中的"洗牌卡片"依然有效，作为优先级排序后的二次洗牌

## 🔧 配置说明

- **默认优先级**: 70（适中优先级）
- **滑块步长**: 5（便于快速调整）
- **显示逻辑**: 仅在有卡片且未完成学习时显示
- **保存时机**: 窗口关闭或学习完成时批量保存

## 🚀 性能优化

- **延迟保存**: 避免频繁IO操作
- **批量处理**: 一次性保存所有修改
- **内存管理**: 保存后清理状态，防止内存泄露
- **错误处理**: 保存失败时的控制台日志记录

## 🔄 向后兼容

- 现有卡片数据完全兼容
- 没有优先级字段的卡片自动使用默认值 70
- 不影响现有的间隔重复算法
- 保留所有现有功能和设置

## 🎯 用户体验

- **直观操作**: 滑块界面简单明了
- **即时反馈**: 修改后立即显示当前优先级
- **中文界面**: 完全本地化的用户界面
- **性能流畅**: 本地状态管理，无延迟感

这个优先级功能将帮助用户更好地管理学习队列，优先复习重要卡片，提升学习效率。

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
│   ├── Footer.tsx               # 原有按钮功能（保持原有布局）
│   └── PrioritySlider.tsx       # 独立的优先级滑块组件
├── queries/
│   ├── today.ts                 # 修改排序逻辑（优先级排序）
│   └── save.ts                  # 新增优先级保存功能
├── models/
│   └── session.ts               # 扩展 Session 类型支持优先级
└── extension.tsx                # 插件入口，处理卸载清理
``` 