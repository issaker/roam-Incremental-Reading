# 陈述性记忆

## 高价值记忆（评分 ≥ 7）

- 2025/06/30 09:39 START
成功为 Memo Enhanced 插件实现了 SuperMemo 混合学习功能。主要改进：1) 搜索增强的牌组选择器(TagSelector组件支持filterable)；2) 自动识别所有Roam Pages作为牌组(useAllPages hook)；3) 牌组优先级管理系统(useDeckPriority hook + DeckPriorityManager UI)；4) 默认FIX模式(修改generateNewSession)。技术要点：数据流需要从getPracticeData返回cardUids，通过usePracticeData传递到PracticeOverlay。优先级算法：牌组优先级=卡片中位数，批量调整=原优先级×(新中位数/原中位数)。 --tags memo-enhanced roamresearch supermemo 混合学习
--tags #其他 #评分:8 #有效期:长期
- END

