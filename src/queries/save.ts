import * as stringUtils from '~/utils/string';
import * as dateUtils from '~/utils/date';
import { CompleteRecords } from '~/models/session';
import {
  createChildBlock,
  getChildBlock,
  getOrCreateBlockOnPage,
  getOrCreateChildBlock,
  getOrCreatePage,
  getChildBlocksOnPage,
  getChildBlocksByUid,
} from '~/queries/utils';

const getEmojiFromGrade = (grade) => {
  switch (grade) {
    case 5:
      return '🟢';
    case 4:
      return '🔵';
    case 3:
      return '🟠';
    case 2:
      return '🟠';
    case 0:
      return '🔴';
    default:
      return '🟢';
  }
};

export const savePracticeData = async ({ refUid, dataPageTitle, dateCreated, ...data }) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  // Get child that matches refUid
  const cardDataBlockUid = await getOrCreateChildBlock(dataBlockUid, `((${refUid}))`, 0, {
    open: false,
  });

  const referenceDate = dateCreated || new Date();
  const dateCreatedRoamDateString = stringUtils.dateToRoamDateString(referenceDate);
  const emoji = getEmojiFromGrade(data.grade);
  const newDataBlockId = await createChildBlock(
    cardDataBlockUid,
    `[[${dateCreatedRoamDateString}]] ${emoji}`,
    0,
    {
      open: false,
    }
  );

  // Insert new block info
  const nextDueDate = data.nextDueDate || dateUtils.addDays(referenceDate, data.interval);

  for (const key of Object.keys(data)) {
    let value = data[key];
    if (key === 'nextDueDate') {
      value = `[[${stringUtils.dateToRoamDateString(nextDueDate)}]]`;
    } else if (key === 'fsrsState' && typeof value === 'object' && value !== null) {
      // 序列化FSRS状态对象为JSON字符串
      value = JSON.stringify(value);
    }

    await createChildBlock(newDataBlockId, `${key}:: ${value}`, -1);
  }
};

interface BulkSavePracticeDataOptions {
  token: string;
  records: CompleteRecords;
  selectedUids: string[];
  dataPageTitle: string;
}

export const bulkSavePracticeData = async ({
  token,
  records,
  selectedUids,
  dataPageTitle,
}: BulkSavePracticeDataOptions) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });
  const graphName = window.roamAlphaAPI.graph.name;

  const payload = {
    graphName,
    data: {
      action: 'batch-actions',
      actions: [],
    },
  };

  // Create practice entries
  for (const refUid of selectedUids) {
    // Check if entry already exists, if it does, delete it first so we don't
    // have duplicates
    const existingEntryUid = getChildBlock(dataBlockUid, `((${refUid}))`);
    if (existingEntryUid) {
      payload.data.actions.push({
        action: 'delete-block',
        block: {
          uid: existingEntryUid,
        },
      });
    }

    const entryUid = window.roamAlphaAPI.util.generateUID();
    payload.data.actions.push({
      action: 'create-block',
      location: {
        'parent-uid': dataBlockUid,
        order: 0,
      },
      block: {
        string: `((${refUid}))`,
        uid: entryUid,
        open: false,
      },
    });

    // Add sessions
    const sessions = records[refUid];
    for (const session of sessions) {
      // Add Session Heading
      const dateCreatedRoamDateString = stringUtils.dateToRoamDateString(session.dateCreated);
      const emoji = getEmojiFromGrade(session.grade);
      const sessionHeadingUid = window.roamAlphaAPI.util.generateUID();
      payload.data.actions.push({
        action: 'create-block',
        location: {
          'parent-uid': entryUid,
          order: 0,
        },
        block: {
          string: `[[${dateCreatedRoamDateString}]] ${emoji}`,
          uid: sessionHeadingUid,
          open: false,
        },
      });

      // Add Session Data
      for (const key of Object.keys(session)) {
        let value = session[key];
        if (key === 'dateCreated') continue; // no need to store this
        if (key === 'nextDueDate') {
          value = `[[${stringUtils.dateToRoamDateString(value)}]]`;
        } else if (key === 'fsrsState' && typeof value === 'object' && value !== null) {
          // 序列化FSRS状态对象为JSON字符串
          value = JSON.stringify(value);
        }
        payload.data.actions.push({
          action: 'create-block',
          location: {
            'parent-uid': sessionHeadingUid,
            order: -1,
          },
          block: {
            string: `${key}:: ${value}`,
            open: false,
          },
        });
      }
    }
  }
  const baseUrl = 'https://roam-memo-server.onrender.com';
  try {
    await fetch(`${baseUrl}/save-roam-sr-data`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error Bulk Saving', error);
  }
};

// 🎯 协同排名系统 - 核心API函数
export const loadCardRankings = async ({ 
  dataPageTitle 
}: { 
  dataPageTitle: string; 
}): Promise<string[]> => {
  try {
    await getOrCreatePage(dataPageTitle);
    const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
      open: false,
      heading: 3,
    });

    // 查找"Priority Rankings"容器block（支持两种格式）
    let priorityContainerUid = getChildBlock(dataBlockUid, 'Priority Rankings');
    if (!priorityContainerUid) {
      // 兼容旧的粗体格式
      priorityContainerUid = getChildBlock(dataBlockUid, '**Priority Rankings**');
    }
    
    if (!priorityContainerUid) {
      console.log('🎯 协同排名系统 - 容器block不存在，返回空列表');
      return [];
    }

    console.log('🎯 协同排名系统 - 找到容器block:', priorityContainerUid);

    // 在容器中查找priority-ranking数据
    const containerBlocks = await getChildBlocksByUid(priorityContainerUid);
    
    if (!containerBlocks || containerBlocks.length === 0) {
      console.log('🎯 协同排名系统 - 容器为空，返回空列表');
      return [];
    }

    console.log('🎯 协同排名系统 - 容器中包含blocks:', containerBlocks.map(b => b.string));

    const priorityBlock = containerBlocks?.find(block => 
      block.string && block.string.startsWith('priority-ranking::')
    );

    if (!priorityBlock) {
      console.log('🎯 协同排名系统 - 未找到priority-ranking数据block');
      return [];
    }

    const orderString = priorityBlock.string.replace('priority-ranking::', '').trim();
    if (!orderString) {
      console.log('🎯 协同排名系统 - priority-ranking数据为空');
      return [];
    }

    // 支持双重括号格式的解析：((uid1)),((uid2)),((uid3))
    const rankings = orderString
      .split(',')
      .map(uid => uid.trim())
      .map(uid => {
        // 移除双重括号，如果存在的话
        if (uid.startsWith('((') && uid.endsWith('))')) {
          return uid.slice(2, -2);
        }
        return uid;
      })
      .filter(uid => uid);
    
    console.log('🎯 协同排名系统 - 从容器中成功读取排名列表:', rankings.length, '个卡片');
    return rankings;
  } catch (error) {
    console.error('协同排名系统 - 读取排名列表失败:', error);
    return [];
  }
};

export const saveCardRankings = async ({ 
  dataPageTitle, 
  rankings 
}: { 
  dataPageTitle: string; 
  rankings: string[]; 
}) => {
  try {
    if (!window.roamAlphaAPI) {
      throw new Error('Roam Alpha API 不可用');
    }

    await getOrCreatePage(dataPageTitle);
    const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
      open: false,
      heading: 3,
    });

    console.log('🎯 协同排名系统 - 准备保存到data block:', dataBlockUid);

    // 检查并迁移旧的priority-ranking数据（直接在data block下的）
    const oldRankingBlockUid = getChildBlock(dataBlockUid, 'priority-ranking::', { exactMatch: false });
    if (oldRankingBlockUid) {
      console.log('🎯 协同排名系统 - 发现旧数据，正在删除:', oldRankingBlockUid);
      await window.roamAlphaAPI.deleteBlock({ block: { uid: oldRankingBlockUid } });
    }

    // 检查并删除旧的粗体格式容器
    const oldBoldContainerUid = getChildBlock(dataBlockUid, '**Priority Rankings**');
    if (oldBoldContainerUid) {
      console.log('🎯 协同排名系统 - 发现旧粗体容器，正在删除:', oldBoldContainerUid);
      await window.roamAlphaAPI.deleteBlock({ block: { uid: oldBoldContainerUid } });
    }

    // 获取或创建"Priority Rankings"容器block
    const priorityContainerUid = await getOrCreateChildBlock(
      dataBlockUid, 
      'Priority Rankings', // 使用普通block文本
      0, // 放在data block的最前面
      { 
        open: false,
        // 不使用heading属性，保持为普通block
      }
    );

    console.log('🎯 协同排名系统 - 容器block UID:', priorityContainerUid);

    // 在容器中查找现有的priority-ranking数据
    const containerBlocks = await getChildBlocksByUid(priorityContainerUid);
    console.log('🎯 协同排名系统 - 容器中现有blocks:', containerBlocks?.map(b => b.string));

    const existingRankingBlock = containerBlocks?.find(block => 
      block.string && block.string.startsWith('priority-ranking::')
    );
    
    // 使用双重括号格式：((uid1)),((uid2)),((uid3))
    const rankingString = rankings.map(uid => `((${uid}))`).join(',');
    const fullString = `priority-ranking:: ${rankingString}`;
    
    console.log('🎯 协同排名系统 - 准备保存数据，卡片数量:', rankings.length);
    
    if (existingRankingBlock) {
      // 更新现有的ranking block
      await window.roamAlphaAPI.updateBlock({
        block: {
          uid: existingRankingBlock.uid,
          string: fullString
        }
      });
      console.log('🎯 协同排名系统 - 在容器中更新排名列表:', rankings.length, '个卡片');
    } else {
      // 在容器中创建新的ranking block
      const newBlockUid = await createChildBlock(priorityContainerUid, fullString, -1);
      console.log('🎯 协同排名系统 - 在容器中创建排名列表:', rankings.length, '个卡片, UID:', newBlockUid);
    }
    
    console.log('🎯 协同排名系统 - 保存操作完成');
  } catch (error) {
    console.error('协同排名系统 - 保存排名列表失败:', error);
    throw error;
  }
};

// 🎯 获取卡片的当前排名
export const getCardRank = ({
  refUid,
  priorityOrder,
  allCardsCount,
  defaultPriority,
}: {
  refUid: string;
  priorityOrder: string[];
  allCardsCount: number;
  defaultPriority: number;
}): number => {
  // ✅ 防御性编程：确保priorityOrder是一个数组
  if (!priorityOrder || priorityOrder.length === 0) {
    // 如果排名列表为空，则根据默认优先级估算一个排名
    return Math.max(1, Math.ceil(allCardsCount * (1 - defaultPriority / 100)));
  }
  
  const index = priorityOrder.indexOf(refUid);
  
  // 如果卡片不在排名列表中（新卡片），则根据默认优先级估算
  if (index === -1) {
    return Math.max(1, Math.ceil(allCardsCount * (1 - defaultPriority / 100)));
  }
  
  return index + 1; // 排名从1开始
};

// 🎯 批量保存排名变更（协同处理）
export const bulkSaveRankingChanges = async ({ 
  rankingChanges,
  dataPageTitle,
  allCardUids
}: { 
  rankingChanges: Record<string, number>; 
  dataPageTitle: string;
  allCardUids: string[];
}) => {
  try {
    // ✅ 参数验证
    if (!rankingChanges || Object.keys(rankingChanges).length === 0) {
      return;
    }
    if (!dataPageTitle?.trim() || !allCardUids?.length) {
      throw new Error('dataPageTitle 或 allCardUids 不能为空');
    }

    console.log(`🎯 协同排名系统 - 开始批量保存排名变更: ${Object.keys(rankingChanges).length} 个变更`);

    // 1. 加载当前排名
    let currentRankings = await loadCardRankings({ dataPageTitle });
    // 如果没有排名，则使用所有卡片的列表作为基础
    if (currentRankings.length === 0) {
      currentRankings = [...allCardUids];
    }
    
    // 2. 创建一个已变更卡片的Set，用于O(1)复杂度的快速查找
    const changedUids = new Set(Object.keys(rankingChanges));

    // 3. 创建一个只包含未变更卡片的稳定列表，保持其原有相对顺序
    const unchangedCards = currentRankings.filter(uid => !changedUids.has(uid));

    // 4. 将变更按目标排名排序，然后将它们插入到稳定列表中
    const sortedChanges = Object.entries(rankingChanges).sort(([,a], [,b]) => a - b);
    
    let newRankings = unchangedCards;
    for (const [cardUid, targetRank] of sortedChanges) {
      // 确保目标排名在有效范围内
      const insertIndex = Math.max(0, Math.min(targetRank - 1, newRankings.length));
      newRankings.splice(insertIndex, 0, cardUid);
    }
    
    // ✅ 验证结果的完整性
    if (new Set(newRankings).size !== newRankings.length) {
      console.error("排名列表包含重复卡片，保存操作已中止。");
      throw new Error('排名列表包含重复卡片');
    }

    // ✅ 原子性保存
    await saveCardRankings({ dataPageTitle, rankings: newRankings });
    
    console.log(`🎯 协同排名系统 - 批量保存排名变更完成: ${newRankings.length} 个卡片`);
  } catch (error) {
    console.error('🎯 协同排名系统 - 批量保存排名变更失败:', error);
    
    // ✅ 提供更详细的错误信息
    if (error.message?.includes('API')) {
      throw new Error('网络连接失败，请检查网络后重试');
    } else if (error.message?.includes('权限')) {
      throw new Error('没有修改权限，请检查Roam Research设置');
    } else {
      throw new Error(`保存失败: ${error.message || '未知错误'}`);
    }
  }
};
