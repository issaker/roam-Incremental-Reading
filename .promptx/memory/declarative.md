# 陈述性记忆

## 高价值记忆（评分 ≥ 7）

- 2025/06/30 09:39 START
成功为 Memo Enhanced 插件实现了 SuperMemo 混合学习功能。主要改进：1) 搜索增强的牌组选择器(TagSelector组件支持filterable)；2) 自动识别所有Roam Pages作为牌组(useAllPages hook)；3) 牌组优先级管理系统(useDeckPriority hook + DeckPriorityManager UI)；4) 默认FIX模式(修改generateNewSession)。技术要点：数据流需要从getPracticeData返回cardUids，通过usePracticeData传递到PracticeOverlay。优先级算法：牌组优先级=卡片中位数，批量调整=原优先级×(新中位数/原中位数)。 --tags memo-enhanced roamresearch supermemo 混合学习
--tags #其他 #评分:8 #有效期:长期
- END



- 2025/06/30 10:35 START
Memo Enhanced插件优先级算法改进方案：三层优先级系统 - 1)牌组重要性等级(1-5星，对应0.5x-3.0x权重)；2)卡片最终优先级=基础优先级×牌组权重；3)跨牌组混合队列按最终优先级排序。用户界面使用星级选择器替代数字输入，提供实时影响预览。技术实现：数据存储在roam/memo/deck-config页面，批量更新priorityOrder，算法简单高效。产品价值：直观的用户体验，更好的学习效果，向后兼容。 --tags memo-enhanced priority-algorithm deck-management user-experience
--tags #其他 #评分:8 #有效期:长期
- END

- 2025/06/30 10:50 START
Memo Enhanced插件侧边栏按钮消失问题修复：根因是在Header组件添加新props(isGlobalMixedMode, setIsGlobalMixedMode)时没有定义TypeScript类型，导致运行时错误让整个插件崩溃。修复方案：1)添加完整的props类型接口定义；2)防御性编程处理todaySelectedTag可能undefined的情况；3)所有属性访问添加默认值保护。教训：在React组件中添加新props时必须同步更新TypeScript类型，否则会导致整个应用崩溃。 --tags memo-enhanced typescript-error react-debugging sidebar-fix defensive-programming
--tags #其他 #评分:8 #有效期:长期
- END