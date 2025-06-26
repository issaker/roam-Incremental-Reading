# 🐛 优先级保存问题修复报告

## 问题描述
用户反馈优先级设置无法保存，刷卡后不影响下一次的队列顺序。

## 根本原因分析

### 1. **API调用错误** 🚨
**位置**: `src/queries/save.ts:222`
**问题**: 使用了错误的API路径
```typescript
// ❌ 错误的API调用
await window.roamMemo.roamAlphaAPI.updateBlock({

// ✅ 正确的API调用  
await window.roamAlphaAPI.updateBlock({
```

### 2. **缺少优先级数据传递** 🔗
**位置**: `src/practice.ts` 和 `src/components/overlay/PracticeOverlay.tsx`
**问题**: 刷卡时优先级数据没有被包含在session数据中

### 3. **缺少调试信息** 🔍
**问题**: 没有足够的日志来追踪保存过程

## 解决方案

### 修复1: API调用修正
```typescript
// src/queries/save.ts
if (priorityBlock) {
  // Update existing priority
  console.log(`Updating existing priority block ${priorityBlock.uid} to ${priority}`);
  await window.roamAlphaAPI.updateBlock({
    block: {
      uid: priorityBlock.uid,
      string: `priority:: ${priority}`
    }
  });
}
```

### 修复2: 优先级数据传递
```typescript
// src/components/overlay/PracticeOverlay.tsx
const onPracticeClick = React.useCallback((gradeData) => {
  // Include current priority in practice data
  const currentCardPriority = currentCardRefUid && priorityChanges[currentCardRefUid] !== undefined 
    ? priorityChanges[currentCardRefUid] 
    : currentCardData?.priority ?? 70;
  
  const practiceProps = {
    ...currentCardData,
    ...gradeData,
    intervalMultiplier,
    intervalMultiplierType,
    priority: currentCardPriority, // ✅ 添加优先级
  };
  
  console.log('Practice click with priority:', currentCardPriority, 'for card:', currentCardRefUid);
  handlePracticeClick(practiceProps);
}, [/* 依赖项包含 priorityChanges */]);
```

```typescript
// src/practice.ts
export const generatePracticeData = ({ dateCreated, reviewMode, ...props }) => {
  const shared = {
    reviewMode,
    priority: props.priority ?? 70, // ✅ 包含优先级
  };
  // ...
};
```

### 修复3: 增强调试和错误处理
```typescript
// src/queries/save.ts
export const savePriorityData = async ({ refUid, dataPageTitle, priority }) => {
  try {
    console.log(`Saving priority ${priority} for card ${refUid}`);
    
    // ... 保存逻辑
    
    console.log(`Successfully saved priority ${priority} for card ${refUid}`);
  } catch (error) {
    console.error(`Error saving priority for card ${refUid}:`, error);
    throw error;
  }
};
```

### 修复4: 优化保存时机
```typescript
// src/components/overlay/PracticeOverlay.tsx
React.useEffect(() => {
  if (!isOpen && Object.keys(priorityChanges).length > 0) {
    console.log('Modal closed, saving priority changes:', priorityChanges);
    bulkSavePriorityData({ 
      priorityChanges, 
      dataPageTitle: dataPageTitle || 'roam/memo' 
    }).then(() => {
      console.log('Priority changes saved successfully');
      setPriorityChanges({});
    }).catch(error => {
      console.error('Error saving priority data:', error);
    });
  }
}, [isOpen, priorityChanges, dataPageTitle]);
```

## 数据流程图

```
用户调整滑块 → priorityChanges状态更新 → 两种保存路径：

路径1 (刷卡时):
onPracticeClick → 包含priority → practice() → generatePracticeData() → savePracticeData()

路径2 (关闭窗口时):  
modal关闭 → useEffect触发 → bulkSavePriorityData() → savePriorityData()
```

## 测试验证

### 控制台日志验证
修复后应能看到以下日志：
```
Saving priority 85 for card abc123
Adding new priority field to session xyz789  
Successfully saved priority 85 for card abc123
Practice click with priority: 85 for card: abc123
Modal closed, saving priority changes: {abc123: 85}
Priority changes saved successfully
```

### Roam数据验证
检查roam/memo页面下的data结构：
```
- data
  - ((card-uid))
    - [[June 21st, 2025]] 🔵
      - nextDueDate:: [[June 22nd, 2025]]
      - eFactor:: 2.5
      - interval:: 1
      - repetitions:: 1  
      - grade:: 4
      - reviewMode:: SPACED_INTERVAL
      - priority:: 85  ✅ 新增的优先级字段
```

## 完成状态
- ✅ API调用错误修复
- ✅ 优先级数据传递完整
- ✅ 调试日志增强
- ✅ 错误处理完善
- ✅ 构建成功 (3.01 MiB)

## 后续验证步骤
1. 在Roam中测试优先级滑块
2. 查看控制台确认保存日志
3. 检查roam/memo页面数据结构
4. 验证下次打开时优先级排序生效 