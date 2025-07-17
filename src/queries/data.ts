import { getStringBetween, parseConfigString, parseRoamDateString } from '~/utils/string';
import * as stringUtils from '~/utils/string';
import { CompleteRecords, Records, RecordUid, ReviewModes } from '~/models/session';
import { Today } from '~/models/practice';
import {
  addDueCards,
  addNewCards,
  calculateCombinedCounts,
  calculateCompletedTodayCounts,
  calculateTodayStatus,
  initializeToday,
  restoreCompletedUids,
} from '~/queries/today';
import { getChildBlocksOnPage, getPageUidsFromTitles } from './utils';
// 🎯 使用新的数组索引优先级系统
import { loadPriorityOrder, savePriorityOrder } from '~/queries/save';
import { ArrayPriorityManager } from '~/utils/ArrayPriorityManager';

// 🎯 改进：使用按dataPageTitle的细粒度锁而非全局锁
const prefillStates = new Map<string, {
  isInProgress: boolean;
  lastTime: number;
  debounceMs: number;
}>();

// 获取或创建特定页面的状态
const getPageState = (dataPageTitle: string) => {
  if (!prefillStates.has(dataPageTitle)) {
    prefillStates.set(dataPageTitle, {
      isInProgress: false,
      lastTime: 0,
      debounceMs: 1000,
    });
  }
  return prefillStates.get(dataPageTitle)!;
};

// 🚀 新增：快速统计数据获取函数
export const getQuickStats = async ({
  tagsList,
  dataPageTitle,
  dailyLimit,
  isGlobalMixedMode = false,
}) => {
  try {
    // 获取基础统计数据，不加载完整的卡片数据
    const today = initializeToday({ tagsList, cachedData: {} });
    let allCardsCount = 0;
    
    // 快速统计每个标签的卡片数量
    for (const tag of tagsList) {
      const cardUids = await getPageReferenceIds(tag, dataPageTitle);
      const tagCardUids = getSelectedTagPageBlocksIds(tag);
      const allTagCardUids = [...cardUids, ...tagCardUids];
      
      allCardsCount += allTagCardUids.length;
      
      // 设置基础统计（不计算详细的due/new状态）
      today.tags[tag] = {
        ...today.tags[tag],
        due: 0,
        new: 0,
        completed: 0,
        dueUids: [] as string[],
        newUids: [] as string[],
        renderMode: today.tags[tag]?.renderMode || 'normal',
        status: 'notStarted' as any,
      };
    }
    
    // 计算全局混合模式统计
    if (isGlobalMixedMode) {
      calculateCombinedCounts({ today, tagsList });
    }
    
    return {
      todayStats: today,
      allCardsCount,
    };
  } catch (error) {
    console.error('🚀 [getQuickStats] 快速统计失败:', error);
    // 返回空的统计数据
    return {
      todayStats: initializeToday({ tagsList, cachedData: {} }),
      allCardsCount: 0,
    };
  }
};

export const getPracticeData = async ({
  tagsList,
  dataPageTitle,
  dailyLimit,
  isCramming,
  cachedData,
  defaultPriority = 70,
  isGlobalMixedMode = false,
}) => {
  const pluginPageData = (await getPluginPageData({
    dataPageTitle,
    limitToLatest: false,
  })) as CompleteRecords;

  const today = initializeToday({ tagsList, cachedData });
  const sessionData = {};
  const cardUids: Record<string, RecordUid[]> = {};

  for (const tag of tagsList) {
    const { sessionData: currentSessionData, cardUids: currentCardUids } = await getSessionData({
      pluginPageData,
      tag,
      dataPageTitle,
    });

    sessionData[tag] = currentSessionData;
    cardUids[tag] = currentCardUids;
  }
  
  // 计算所有tagged的卡片
  const allCardUids = new Set<string>();
  for (const tag of tagsList) {
    cardUids[tag].forEach(uid => allCardUids.add(uid));
  }
  const allCardsCount = Math.max(1, allCardUids.size);

  // 🎯 使用新的数组索引优先级管理器
  const priorityManager = await updatePriorityManagerWithSettings(
    allCardUids,
    dataPageTitle,
    defaultPriority
  );
  
  // 获取排序后的UID列表
  const priorityOrder = priorityManager.getSortedUids();

  await calculateCompletedTodayCounts({
    today,
    tagsList,
    sessionData,
  });

  addNewCards({ today, tagsList, cardUids, pluginPageData, priorityOrder });
  addDueCards({
    today,
    tagsList,
    sessionData,
    isCramming,
    priorityOrder,
  });
  
  calculateCombinedCounts({ today, tagsList });
  limitRemainingPracticeData({
    today,
    dailyLimit,
    tagsList,
    isCramming,
    isGlobalMixedMode,
    priorityOrder,
  });
  calculateCombinedCounts({ today, tagsList });
  calculateTodayStatus({ today, tagsList });
  

  return {
    practiceData: pluginPageData,
    todayStats: today,
    allCardsCount,
    priorityOrder,
    priorityManager,
    allCardUids: Array.from(allCardUids),
    cardUids, // 返回按标签分组的 cardUids
  };
};

// 🎯 [核心函数] 数组索引优先级系统管理器
const updatePriorityManagerWithSettings = async (
  allCardUids: Set<string>,
  dataPageTitle: string,
  defaultPriority: number
): Promise<ArrayPriorityManager> => {
  // ✅ 使用页面特定的状态，避免不同页面互相阻塞
  const pageState = getPageState(dataPageTitle);
  const now = Date.now();

  // 1. 加载现有的优先级数据，强化数据保护
  const existingPriorityOrder = await loadPriorityOrder({ dataPageTitle });
  
  // 检查是否为旧格式的浮点数据，进行迁移
  if (existingPriorityOrder && 
      typeof existingPriorityOrder === 'object' && 
      !Array.isArray(existingPriorityOrder) &&
      Object.keys(existingPriorityOrder).length > 0) {
    const manager = ArrayPriorityManager.fromFloatMap(existingPriorityOrder as Record<string, number>);
    await savePriorityOrder({ dataPageTitle, priorityOrder: manager.serialize() });
    return manager;
  }
  
  // 如果读取到有效数据，使用现有数据；否则创建空管理器
  const manager = existingPriorityOrder && Array.isArray(existingPriorityOrder) && existingPriorityOrder.length > 0
    ? ArrayPriorityManager.fromSerialized(existingPriorityOrder)
    : ArrayPriorityManager.fromSerialized([]);

  // 如果当前正在执行或处于防抖间隔内，则直接返回现有管理器
  if (pageState.isInProgress || now - pageState.lastTime < pageState.debounceMs) {
    return manager;
  }

  pageState.isInProgress = true;
  pageState.lastTime = now;

  try {
    // 2. 找出缺失的新卡片
    const existingUids = new Set(manager.getSortedUids());
    const missingCards = Array.from(allCardUids).filter(uid => !existingUids.has(uid));

    // 若没有缺失卡片，则返回现有管理器
    if (missingCards.length === 0) {
      return manager;
    }


    // 3. 为新卡片根据默认优先级确定插入位置
    if (missingCards.length > 0) {
      // 按UID排序确保顺序一致
      const sortedMissingCards = missingCards.sort();
      
      // 根据默认优先级计算插入位置
      const currentOrder = manager.getSortedUids();
      const totalCards = currentOrder.length + sortedMissingCards.length;
      
      // 默认优先级70% = 前30%的位置
      const targetIndex = Math.floor(totalCards * (1 - defaultPriority / 100));
      
      // 将新卡片插入到目标位置
      for (let i = 0; i < sortedMissingCards.length; i++) {
        manager.moveTo(sortedMissingCards[i], targetIndex + i);
      }
    }

    // 4. 保存更新后的优先级顺序（数据保护检查）
    const finalOrder = manager.serialize();
    if (finalOrder.length > 0) {
      await savePriorityOrder({
        dataPageTitle,
        priorityOrder: finalOrder,
      });
    }
    return manager;
  } catch (error) {
    console.error('🎯 优先级管理器更新失败:', error);
    // ✅ 重置状态以允许重试
    pageState.lastTime = 0;
    throw error; // 重新抛出错误，让调用方知道失败了
  } finally {
    pageState.isInProgress = false;
  }
};

export const getDataPageQuery = (dataPageTitle) => `[
  :find ?page
  :where
    [?page :node/title "${dataPageTitle}"]
]`;

export const dataPageReferencesIdsQuery = `[
  :find ?refUid
  :in $ ?tag ?dataPage
  :where
    [?tagPage :node/title ?tag]
    [?tagRefs :block/refs ?tagPage]
    [?tagRefs :block/uid ?refUid]
    [?tagRefs :block/page ?homePage]
    [(!= ?homePage ?dataPage)]
  ]`;
const getPageReferenceIds = async (tag, dataPageTitle): Promise<string[]> => {
  // First query the data page so that we can exclude those references from the results
  const dataPageResult = window.roamAlphaAPI.q(getDataPageQuery(dataPageTitle));

  const dataPageUid = dataPageResult.length ? dataPageResult[0][0] : '';

  const results = window.roamAlphaAPI.q(dataPageReferencesIdsQuery, tag, dataPageUid);

  return results.map((arr) => arr[0]);
};

export const getSelectedTagPageBlocksIds = (selectedTag): string[] => {
  const queryResults = getChildBlocksOnPage(selectedTag);

  if (!queryResults.length) return [];

  const children = queryResults[0][0].children;
  const filteredChildren = children.filter((child) => !!child.string);

  return filteredChildren.map((arr) => arr.uid);
};

// Ensure that the reviewMode field is always present
const ensureReviewModeField = (record) => {
  const hasReviewModeField = record.children.some((child) => child.string.includes('reviewMode'));
  const children = hasReviewModeField
    ? record.children
    : [
        ...record.children,
        {
          order: record.children.length,
          string: `reviewMode:: ${ReviewModes.DefaultSpacedInterval}`,
        },
      ];

  return {
    ...record,
    children,
  };
};

const parseFieldValues = (object, node) => {
  for (const field of ensureReviewModeField(node).children) {
    const [key, value] = parseConfigString(field.string);

    if (key === 'nextDueDate') {
      object[key] = parseRoamDateString(getStringBetween(value, '[[', ']]'));
    } else if (value === 'true' || value === 'false') {
      object[key] = value === 'true';
    } else if (stringUtils.isNumeric(value)) {
      object[key] = Number(value);
    } else {
      object[key] = value;
    }
  }
};

const mapPluginPageDataLatest = (queryResultsData): Records =>
  queryResultsData
    .map((arr) => arr[0])[0]
    .children?.reduce((acc, cur) => {
      const uid = getStringBetween(cur.string, '((', '))');
      acc[uid] = {};

      if (!cur.children) return acc;

      const latestChild = cur.children.find((child) => child.order === 0);
      acc[uid].dateCreated = parseRoamDateString(getStringBetween(latestChild.string, '[[', ']]'));

      if (!latestChild.children) return acc;
      parseFieldValues(acc[uid], latestChild);

      return acc;
    }, {}) || {};

const mapPluginPageData = (queryResultsData): CompleteRecords =>
  queryResultsData
    .map((arr) => arr[0])[0]
    .children?.reduce((acc, cur) => {
      const uid = getStringBetween(cur.string, '((', '))');
      acc[uid] = [];

      // Add date
      if (!cur.children) return acc;

      for (const child of cur.children) {
        const record = {
          refUid: uid,
          dateCreated: parseRoamDateString(getStringBetween(child.string, '[[', ']]')),
        };

        if (!child.children) return acc;

        parseFieldValues(record, child);

        acc[uid].push(record);
      }

      return acc;
    }, {}) || {};

export const getPluginPageBlockDataQuery = `[
  :find (pull ?pluginPageChildren [
    :block/string
    :block/children
    :block/order
    {:block/children ...}])
    :in $ ?pageTitle ?dataBlockName
    :where
    [?page :node/title ?pageTitle]
    [?page :block/children ?pluginPageChildren]
    [?pluginPageChildren :block/string ?dataBlockName]
  ]`;

const getPluginPageBlockData = async ({ dataPageTitle, blockName }) => {
  return await window.roamAlphaAPI.q(getPluginPageBlockDataQuery, dataPageTitle, blockName);
};

export const getPluginPageData = async ({ dataPageTitle, limitToLatest = true }) => {
  const queryResultsData = await getPluginPageBlockData({ dataPageTitle, blockName: 'data' });

  if (!queryResultsData.length) return {};

  return limitToLatest
    ? mapPluginPageDataLatest(queryResultsData)
    : mapPluginPageData(queryResultsData);
};

const mapPluginPageCachedData = (queryResultsData) => {
  const data = queryResultsData.map((arr) => arr[0])[0].children;
  if (!data || !data.length) return {};

  if (!data?.length) return {};

  return (
    data.reduce((acc, cur) => {
      const tag = getStringBetween(cur.string, '[[', ']]');
      acc[tag] =
        cur.children?.reduce((acc, cur) => {
          if (!cur.string) return acc;
          const [key, value] = cur.string.split('::').map((s: string) => s.trim());

          const date = parseRoamDateString(value);
          acc[key] = date ? date : value;

          return acc;
        }, {}) || {};
      return acc;
    }, {}) || {}
  );
};

export const getPluginPageCachedData = async ({ dataPageTitle }) => {
  const queryResultsData = await getPluginPageBlockData({ dataPageTitle, blockName: 'cache' });

  if (!queryResultsData.length) return {};

  return mapPluginPageCachedData(queryResultsData);
};

/**
 * Gets all the card referencing a tag, then finds all the practice session data for those cards
 */
export const getSessionData = async ({
  pluginPageData,
  tag,
  dataPageTitle,
}: {
  pluginPageData: CompleteRecords;
  tag: string;
  dataPageTitle: string;
}) => {
  // Get all the cards for the tag
  const tagReferencesIds = await getPageReferenceIds(tag, dataPageTitle);
  const tagPageBlocksIds = getSelectedTagPageBlocksIds(tag);
  const allTagCardsUids = tagReferencesIds.concat(tagPageBlocksIds);

  // Filter out due cards that aren't references to the currently selected tag
  // @TODO: we could probably do this at getPluginPageData query for a
  // performance boost
  const selectedTagCardsData = Object.keys(pluginPageData).reduce((acc, cur) => {
    if (allTagCardsUids.indexOf(cur) > -1) {
      acc[cur] = pluginPageData[cur];
    }
    return acc;
  }, {});

  return {
    sessionData: selectedTagCardsData,
    cardUids: allTagCardsUids,
  };
};

/**
 *  Limit of cards to practice ensuring that due cards are always
 *  first but ~25% new cards are still practiced when limit is less than total due
 *  cards.
 */
const limitRemainingPracticeData = ({
  today,
  dailyLimit,
  tagsList,
  isCramming,
  isGlobalMixedMode,
  priorityOrder,
}: {
  today: Today;
  dailyLimit: number;
  tagsList: string[];
  isCramming: boolean;
  isGlobalMixedMode: boolean;
  priorityOrder: string[];
}) => {
  const totalCards = today.combinedToday.due + today.combinedToday.new;

  // Conditions where we skip limiting:
  // 1. No limit set (0)
  // 2. No cards to practice
  // 3. Cramming mode（临时突击模式）
  // 4. 非混合学习模式（只学习单牌组时，不受每日上限影响）
  if (!dailyLimit || !totalCards || isCramming || !isGlobalMixedMode) {
    return;
  }

  // --- 1. 收集已完成卡片信息，用于后续过滤 ---
  const globalCompletedDue = new Set<string>();
  const globalCompletedNew = new Set<string>();
  
  for (const tag of tagsList) {
    const tagStats = today.tags[tag];
    (tagStats.completedDueUids || []).forEach(uid => globalCompletedDue.add(uid));
    (tagStats.completedNewUids || []).forEach(uid => globalCompletedNew.add(uid));
  }

  // --- 2. 计算目标数量（75% 旧卡 + 25% 新卡），考虑已完成卡片 ---
  const targetNewRatio = 0.25;
  const totalCompleted = globalCompletedDue.size + globalCompletedNew.size;
  const remainingQuota = Math.max(0, dailyLimit - totalCompleted);
  
  
  const targetNew = remainingQuota === 1 ? 0 : Math.max(0, Math.floor(remainingQuota * targetNewRatio));
  const targetDue = remainingQuota - targetNew;

  // --- 3. 构建排名映射，便于按优先级排序 ---
  const rankMap = new Map<string, number>(
    priorityOrder.map((uid, idx) => [uid, idx])
  );

  const sortByPriority = (uids: string[]) =>
    [...uids].sort(
      (a, b) => (rankMap.get(a) ?? Number.MAX_SAFE_INTEGER) - (rankMap.get(b) ?? Number.MAX_SAFE_INTEGER)
    );

  // --- 4. 收集全局 Due / New 列表，排除已完成卡片，并按优先级排序 ---
  const globalDue: string[] = [];
  const globalNew: string[] = [];

  for (const tag of tagsList) {
    // 排除已完成的卡片
    const availableDue = today.tags[tag].dueUids.filter(uid => !globalCompletedDue.has(uid));
    const availableNew = today.tags[tag].newUids.filter(uid => !globalCompletedNew.has(uid));
    
    globalDue.push(...availableDue);
    globalNew.push(...availableNew);
  }

  const sortedDue = sortByPriority(globalDue);
  const sortedNew = sortByPriority(globalNew);

  // --- 5. 挑选目标数量的卡片 ---
  let selectedDue = sortedDue.slice(0, targetDue);
  let selectedNew = sortedNew.slice(0, targetNew);

  // 如果某一类不足，则用另一类补足（避免重复）
  if (selectedDue.length < targetDue) {
    const shortage = targetDue - selectedDue.length;
    const extra = sortedNew.filter((uid) => !selectedNew.includes(uid)).slice(0, shortage);
    selectedNew = selectedNew.concat(extra);
  }

  if (selectedNew.length < targetNew) {
    const shortage = targetNew - selectedNew.length;
    const extra = sortedDue.filter((uid) => !selectedDue.includes(uid)).slice(0, shortage);
    selectedDue = selectedDue.concat(extra);
  }

  // --- 6. 构建选中集合，便于过滤 ---
  const selectedDueSet = new Set(selectedDue);
  const selectedNewSet = new Set(selectedNew);

  // --- 7. 根据选中结果，更新各牌组数据 ---
  for (const tag of tagsList) {
    const tagStats = today.tags[tag];

    // 只保留被选中的卡片（已完成的卡片在步骤4中已被排除）
    const dueUids = tagStats.dueUids.filter(uid => selectedDueSet.has(uid));
    const newUids = tagStats.newUids.filter(uid => selectedNewSet.has(uid));

    today.tags[tag] = {
      ...tagStats,
      dueUids,
      newUids,
      due: dueUids.length,
      new: newUids.length,
    };
  }
};
