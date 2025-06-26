# 🧠 调度算法选择器使用指南

## 概述

本插件现在支持两种间隔重复调度算法：
- **SM2** (SuperMemo 2) - 经典的间隔重复算法
- **FSRS** (Free Spaced Repetition Scheduler) - 现代的机器学习算法

## 功能特点

### ✅ 完全向后兼容
- 现有的SM2卡片数据不会受到影响
- 可以随时在两种算法之间切换
- 算法选择对现有学习进度无损

### ✅ 保守升级策略
- SM2算法保持原有的实现，未做任何修改
- FSRS算法作为新的选择项添加
- 默认使用SM2算法，确保稳定性

### ✅ 智能数据管理
- FSRS卡片会额外保存内部状态信息
- SM2卡片继续使用原有的数据结构
- 数据存储格式自动适配算法类型

## 使用方法

### 1. 打开设置页面
在Roam Research中，打开插件的设置页面。

### 2. 选择调度算法
找到"调度算法选择 / Scheduling Algorithm"选项，可以选择：
- **SM2 (SuperMemo 2) - 默认**：经典算法，稳定可靠
- **FSRS (Free Spaced Repetition Scheduler) - 新算法**：现代算法，更准确的记忆预测

### 3. 算法切换生效
- 新创建的卡片将使用选择的算法
- 现有卡片在下次复习时应用新算法
- 无需重启或额外配置

## 算法对比

### SM2 算法
**优点：**
- 经过多年使用验证，稳定可靠
- 计算简单，性能好
- 适合大多数用户的学习需求
- 与Anki等其他应用兼容

**适用场景：**
- 保守型用户
- 已有大量SM2数据的用户
- 对稳定性要求高的场景

### FSRS 算法
**优点：**
- 基于机器学习，预测更准确
- 能够更好地个性化学习计划
- 科学研究证明优于传统算法
- 长期记忆效果更好

**适用场景：**
- 追求最佳学习效果的用户
- 新用户（没有历史数据包袱）
- 愿意尝试新技术的用户

## 数据存储格式

### SM2 算法数据示例
```
- [[June 20th, 2025]] 🔵
    - nextDueDate:: [[June 21st, 2025]]
    - eFactor:: 2.5
    - interval:: 1
    - repetitions:: 1
    - grade:: 4
    - reviewMode:: SPACED_INTERVAL
```

### FSRS 算法数据示例
```
- [[June 20th, 2025]] 🔵
    - nextDueDate:: [[June 21st, 2025]]
    - eFactor:: 3.2
    - interval:: 1
    - repetitions:: 1
    - grade:: 4
    - reviewMode:: SPACED_INTERVAL
    - fsrsState:: {复杂的FSRS内部状态对象}
```

## 实现细节

### 技术架构
1. **算法适配器** (`src/algorithms/fsrs.ts`)
   - 将FSRS API适配为与SM2兼容的接口
   - 处理评分映射（0-5 → FSRS评级）
   - 管理FSRS内部状态

2. **设置集成** (`src/hooks/useSettings.ts`)
   - 添加`schedulingAlgorithm`设置项
   - 默认值为'SM2'保证向后兼容

3. **练习逻辑修改** (`src/practice.ts`)
   - `generatePracticeData`函数支持算法选择
   - 条件调用SM2或FSRS算法
   - 保存FSRS状态到数据库

4. **UI组件更新**
   - 设置页面添加算法选择器
   - Footer组件传递算法参数用于预览
   - PracticeOverlay组件传递算法选择

### 依赖库
- `ts-fsrs`：TypeScript版本的FSRS算法实现
- 保持与现有依赖的兼容性

## 故障排除

### 常见问题

**Q: 切换算法后卡片间隔异常？**
A: 这是正常现象。FSRS算法的间隔计算方式与SM2不同，可能导致间隔变化。建议持续使用一段时间以获得最佳效果。

**Q: 能否在同一个数据库中混用两种算法？**
A: 不建议。虽然技术上可行，但会导致学习计划混乱。建议选择一种算法并坚持使用。

**Q: FSRS数据会占用更多存储空间吗？**
A: 是的，FSRS会保存额外的内部状态，但增加的空间很小（每张卡片约几KB）。

**Q: 如何查看当前使用的算法？**
A: 检查卡片数据中是否有`fsrsState`字段。有此字段表示使用FSRS，否则使用SM2。

### 性能考虑
- FSRS算法计算比SM2稍复杂，但性能影响微乎其微
- 推荐在稳定的网络环境下进行算法切换
- 大量历史数据的用户建议在低峰时段切换

## 贡献与反馈

如果您在使用过程中遇到问题或有改进建议，请：
1. 查看控制台日志（F12 → Console）获取详细错误信息
2. 在GitHub Issues中报告问题
3. 提供复现步骤和数据示例

## 参考资料

- [FSRS官方文档](https://github.com/open-spaced-repetition/fsrs4anki)
- [SuperMemo算法说明](https://super-memory.com/english/ol/sm2.htm)
- [间隔重复算法对比研究](https://www.nature.com/articles/s41598-019-43111-4)

---

*本功能采用保守升级策略，确保现有用户的学习数据安全。建议新用户尝试FSRS算法以获得更好的学习效果。* 