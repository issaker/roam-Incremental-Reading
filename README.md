# Memo Enhanced - Roam Research 间隔重复插件

## 项目概述

Memo Enhanced 是一个强大的 Roam Research 间隔重复学习插件，实现了 SuperMemo 混合学习效果，支持智能牌组管理、全局优先级系统和渐进式阅读。

## ✨ 核心功能

### 🔍 智能搜索牌组选择器
- 支持关键字实时搜索
- 高亮匹配结果显示
- 中文搜索支持
- 快速定位目标牌组

### 🤖 自动页面发现系统
- 自动识别所有 Roam pages 作为牌组
- 智能排除 Daily Notes
- 每5分钟自动刷新页面列表
- 支持中文排序

### 📊 牌组优先级管理
- 可视化牌组优先级管理界面
- 中位数算法计算牌组优先级（0-100）
- 批量调整整个牌组的卡片优先级
- 实时预览优先级变化

### 🎯 混合学习效果
- 跨牌组全局优先级排序
- SuperMemo 风格的渐进式阅读
- 所有新卡片默认 FIX 模式（手动间隔重复）
- 智能学习队列管理

### 🛠️ 技术特性
- 支持 FSRS 和 SM2 算法
- 协同排名系统
- 智能缓存和性能优化
- 完整的 TypeScript 支持

## 📋 使用方法

### 基础使用
1. 安装插件到 Roam Research
2. 点击侧边栏的 Memo 按钮打开练习界面
3. 使用搜索功能快速找到目标牌组
4. 开始学习！

### 牌组优先级管理
1. 在练习界面点击排序图标（📊）
2. 查看所有牌组的当前优先级中位数
3. 点击编辑调整牌组优先级
4. 保存后该牌组所有卡片按比例调整

### 高级功能
- **混合学习**: 不同牌组的卡片按全局优先级混合排序
- **渐进式阅读**: 高优先级内容优先学习
- **智能发现**: 自动发现新页面并加入牌组列表

## 🔧 技术架构

### 数据流
```
Roam Database (Datalog Query)
       ↓
useAllPages (自动页面发现)
       ↓
usePracticeData (获取卡片数据)
       ↓
getPracticeData (返回完整学习数据)
       ↓
PracticeOverlay (渲染学习界面)
       ↓
useDeckPriority (牌组优先级管理)
```

### 核心组件
- **useAllPages**: 页面自动发现和管理
- **TagSelector**: 搜索增强的牌组选择器
- **DeckPriorityManager**: 可视化优先级管理界面
- **useDeckPriority**: 优先级计算和管理逻辑
- **PracticeOverlay**: 主学习界面

## 📦 安装和构建

### 环境要求
- Node.js 16+
- npm 或 yarn
- Roam Research 环境

### 构建步骤
```bash
# 安装依赖
npm install

# 构建生产版本
npm run build

# 输出: extension.js (3.27MB)
```

### 技术栈
- **前端**: React + TypeScript
- **UI库**: Blueprint.js
- **样式**: Emotion (styled-components)
- **构建**: Webpack 5
- **API**: Roam Alpha API (Datalog)

## 🚧 项目状态

### ✅ 已完成功能 (90%)
1. ✅ 搜索增强牌组选择器
2. ✅ 自动页面发现系统
3. ✅ 牌组优先级管理界面
4. ✅ 默认 FIX 模式设置
5. ✅ 完整数据流集成
6. ✅ Bug修复 - selectedTag同步问题

### 🚧 待完成功能 (10%)
1. 🔲 未定义牌组完整实现
2. 🔲 优先级批量更新后端逻辑
3. 🔲 性能优化（大数据量）
4. 🔲 完善错误处理

### 📊 代码质量
- ✅ TypeScript 编译通过
- ✅ Webpack 构建成功
- ⚠️ Bundle 大小需优化 (3.27MB)
- 🔲 需要单元测试

## 🔧 开发指南

### 文件结构
```
src/
├── components/
│   ├── overlay/PracticeOverlay.tsx    # 主学习界面
│   ├── DeckPriorityManager.tsx        # 优先级管理
│   └── SidePanelWidget.tsx           # 侧边栏按钮
├── hooks/
│   ├── useAllPages.tsx               # 页面发现
│   ├── useDeckPriority.tsx          # 优先级管理
│   └── usePracticeData.tsx          # 学习数据
├── queries/
│   ├── data.ts                       # 数据查询
│   ├── save.ts                       # 数据保存
│   └── utils.ts                      # 工具函数
└── models/
    ├── practice.ts                   # 学习模型
    └── session.ts                    # 会话模型
```

### 关键算法

#### 牌组优先级中位数计算
```typescript
const calculateMedian = (numbers: number[]): number => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[middle - 1] + sorted[middle]) / 2 
    : sorted[middle];
};
```

#### 优先级批量调整公式
```typescript
// 新优先级 = 原优先级 × (新中位数/原中位数)
const newPriority = oldPriority * (newMedian / oldMedian);
```

### 开发规范
- 使用 TypeScript 严格模式
- 遵循 React Hooks 最佳实践
- 添加完整的错误处理
- 考虑性能和用户体验

## ⚠️ 重要提醒

### 运行环境
- 代码依赖 `window.roamAlphaAPI`，必须在 Roam Research 环境中运行
- 优先级调整会影响用户学习数据，需谨慎操作
- 大量页面/卡片时注意性能影响

### 数据安全
- 所有数据保存在用户的 Roam 数据库中
- 不会上传任何个人数据到外部服务器
- 支持完全离线使用

## 🐛 已知问题修复

### Bug修复记录
- ✅ **selectedTag同步问题**: 修复了异步Hook间状态不同步导致的崩溃
- ✅ **防御性编程**: 添加了完善的错误边界处理
- ✅ **数据流一致性**: 确保React组件间数据流的时序一致性

## 📄 许可证

本项目基于原 Memo 插件开发，遵循相同的开源许可证。

## 🤝 贡献指南

1. Fork 本项目
2. 创建 feature 分支
3. 提交变更
4. 发起 Pull Request

## 📞 支持和反馈

如有问题或建议，请通过以下方式联系：
- 创建 GitHub Issue
- 查看项目文档和注释
- 参考代码中的详细实现说明

---

**最后更新**: 2024年12月30日  
**项目状态**: 核心功能完成，可正常使用  
**版本**: v2.1.0 (SuperMemo混合学习增强版)
