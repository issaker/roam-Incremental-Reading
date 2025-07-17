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

// 🎯 新的统一优先级系统 - 只使用数组索引

// 加载优先级顺序数组
export const loadPriorityOrder = async ({ 
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

    // 查找"Priority Rankings"容器block
    let priorityContainerUid = getChildBlock(dataBlockUid, 'Priority Rankings');
    if (!priorityContainerUid) {
      return [];
    }

    // 在容器中查找priority-order数据
    const containerBlocks = getChildBlocksByUid(priorityContainerUid);
    if (!containerBlocks || containerBlocks.length === 0) {
      return [];
    }

    const priorityOrderBlock = containerBlocks?.find(block => 
      block.string && block.string.startsWith('priority-order::')
    );

    if (priorityOrderBlock) {
      const orderString = priorityOrderBlock.string.replace('priority-order::', '').trim();
      if (!orderString) {
        return [];
      }

      try {
        const priorityOrder = JSON.parse(orderString);
        return priorityOrder;
      } catch (parseError) {
        console.error('优先级数据解析失败:', parseError);
        return [];
      }
    }

    return [];
  } catch (error) {
    console.error('优先级系统 - 读取优先级顺序失败:', error);
    return [];
  }
};

// 保存优先级顺序数组
export const savePriorityOrder = async ({ 
  dataPageTitle, 
  priorityOrder 
}: { 
  dataPageTitle: string; 
  priorityOrder: string[]; 
}) => {
  try {
    if (!window.roamAlphaAPI) {
      throw new Error('Roam Alpha API 不可用');
    }

    // 报告保存进度
    window.dispatchEvent(new CustomEvent('memoSavingProgress', { 
      detail: { status: `正在保存 ${priorityOrder.length.toLocaleString()} 张卡片的优先级...`, progress: 10 } 
    }));

    await getOrCreatePage(dataPageTitle);
    
    window.dispatchEvent(new CustomEvent('memoSavingProgress', { 
      detail: { status: '正在准备数据结构...', progress: 30 } 
    }));
    
    const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
      open: false,
      heading: 3,
    });

    // 获取或创建"Priority Rankings"容器block
    const priorityContainerUid = await getOrCreateChildBlock(
      dataBlockUid, 
      'Priority Rankings',
      0,
      { 
        open: false,
      }
    );

    window.dispatchEvent(new CustomEvent('memoSavingProgress', { 
      detail: { status: '正在检查现有数据...', progress: 50 } 
    }));

    // 在容器中查找现有的priority-order数据
    const containerBlocks = getChildBlocksByUid(priorityContainerUid);
    const existingOrderBlock = containerBlocks?.find(block => 
      block.string && block.string.startsWith('priority-order::')
    );
    
    window.dispatchEvent(new CustomEvent('memoSavingProgress', { 
      detail: { status: '正在写入优先级数据...', progress: 80 } 
    }));
    
    // 使用JSON格式存储优先级顺序
    const orderString = JSON.stringify(priorityOrder);
    const fullString = `priority-order:: ${orderString}`;
    
    if (existingOrderBlock) {
      // 更新现有的order block
      await window.roamAlphaAPI.updateBlock({
        block: {
          uid: existingOrderBlock.uid,
          string: fullString
        }
      });
    } else {
      // 在容器中创建新的order block
      await createChildBlock(priorityContainerUid, fullString, -1);
    }
    
    window.dispatchEvent(new CustomEvent('memoSavingProgress', { 
      detail: { status: '保存完成', progress: 100 } 
    }));
  } catch (error) {
    console.error('优先级系统 - 保存优先级顺序失败:', error);
    window.dispatchEvent(new CustomEvent('memoSavingProgress', { 
      detail: { status: '保存失败', progress: 0 } 
    }));
    throw error;
  }
};

