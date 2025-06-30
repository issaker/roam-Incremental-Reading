# SuperMemo 混合学习功能实现总结

## 概述
成功实现了 roamresearch 间隔重复插件的 SuperMemo 混合学习效果，支持全局优先级下的渐进阅读和混合学习方法。

## 实现的功能

### 1. 搜索增强的牌组选择器 ✅
- **位置**: `src/components/overlay/PracticeOverlay.tsx` (TagSelector 组件)
- **功能**: 
  - 支持输入关键字搜索牌组
  - 搜索时高亮匹配部分
  - 支持中文搜索
  - 大量牌组时快速定位

### 2. 自动识别所有 Roam Pages 作为牌组 ✅
- **位置**: `src/hooks/useAllPages.tsx`
- **功能**:
  - 自动获取所有 Roam pages（排除 Daily Notes）
  - 自动加入牌组候选列表
  - 每 5 分钟自动刷新页面列表
  - 支持多种日期格式的 Daily Note 识别

### 3. 牌组优先级管理系统 ✅
- **位置**: 
  - Hook: `src/hooks/useDeckPriority.tsx`
  - UI: `src/components/DeckPriorityManager.tsx`
- **功能**:
  - 计算每个牌组的中位数优先级（0-100）
  - 提供可视化界面管理牌组优先级
  - 支持批量调整整个牌组的卡片优先级
  - 优先级算法：新优先级 = 原优先级 × (新中位数/原中位数)

### 4. 默认 FIX 模式（手动间隔重复）✅
- **位置**: `src/queries/utils.ts` (generateNewSession 函数)
- **功能**:
  - 所有新卡片默认使用 FIX 模式
  - 用户需要手动切换到评分模式

### 5. 未定义牌组（开发中）🚧
- **说明**: "未定义"牌组功能（收集仅属于 Daily Notes 的卡片）已预留接口，但需要进一步实现具体的识别逻辑

## 使用方法

### 搜索牌组
1. 点击牌组选择器
2. 在搜索框中输入关键字
3. 选择匹配的牌组

### 管理牌组优先级
1. 点击练习界面头部的排序图标按钮
2. 在弹出的管理界面中查看所有牌组
3. 点击编辑按钮调整牌组优先级
4. 保存后，该牌组所有卡片的优先级会按比例调整

### 混合学习效果
- 所有牌组的卡片根据全局优先级混合排序
- 优先级高的卡片在学习队列中靠前
- 支持跨牌组的渐进式阅读

## 技术架构

### 数据流
```
Roam Pages → useAllPages → App → PracticeOverlay
                ↓
         usePracticeData
                ↓
         getPracticeData (返回 cardUids)
                ↓
         useDeckPriority (计算牌组优先级)
```

### 关键组件
- **useAllPages**: 自动发现和管理页面列表
- **TagSelector**: 搜索增强的牌组选择器
- **DeckPriorityManager**: 牌组优先级管理界面
- **useDeckPriority**: 计算和管理牌组优先级的业务逻辑

## 性能优化
- 牌组列表缓存，避免频繁查询
- 防抖处理，避免重复计算
- 批量更新优先级，减少 API 调用

## 后续优化建议
1. 实现"未定义"牌组的完整功能
2. 添加牌组优先级的批量操作功能
3. 优化大量卡片时的优先级计算性能
4. 添加牌组统计信息（平均间隔、留存率等） 