import * as React from 'react';
import { getCardRank } from '~/queries/save';

interface DeckPriorityInfo {
  deckName: string;
  medianPriority: number;
  cardCount: number;
}

interface UseDeckPriorityReturn {
  deckPriorities: Record<string, DeckPriorityInfo>;
  updateDeckPriority: (deckName: string, newPriority: number) => void;
  isLoading: boolean;
}

const calculateMedian = (numbers: number[]): number => {
  if (numbers.length === 0) return 50; // 默认中位数
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  
  return sorted[middle];
};

const useDeckPriority = ({
  tagsList,
  practiceData,
  cardUids,
  priorityOrder,
  allCardsCount,
  defaultPriority,
}: {
  tagsList: string[];
  practiceData: any;
  cardUids: Record<string, string[]>;
  priorityOrder: string[];
  allCardsCount: number;
  defaultPriority: number;
}): UseDeckPriorityReturn => {
  const [deckPriorities, setDeckPriorities] = React.useState<Record<string, DeckPriorityInfo>>({});
  const [isLoading, setIsLoading] = React.useState(true);

  // 计算每个牌组的中位数优先级
  const calculateDeckPriorities = React.useCallback(async () => {
    setIsLoading(true);
    const newDeckPriorities: Record<string, DeckPriorityInfo> = {};

    for (const tag of tagsList) {
      const tagCardUids = cardUids[tag] || [];
      
      if (tagCardUids.length === 0) {
        newDeckPriorities[tag] = {
          deckName: tag,
          medianPriority: defaultPriority,
          cardCount: 0,
        };
        continue;
      }

      // 获取每张卡片的优先级
      const priorities: number[] = [];
      
      for (const uid of tagCardUids) {
        const cardRank = await getCardRank({
          refUid: uid,
          priorityOrder,
          allCardsCount,
          defaultPriority,
        });
        
        // 将排名转换为优先级百分比（1 = 100%, allCardsCount = 0%）
        const priority = Math.round((1 - (cardRank - 1) / Math.max(1, allCardsCount - 1)) * 100);
        priorities.push(priority);
      }

      const medianPriority = calculateMedian(priorities);
      
      newDeckPriorities[tag] = {
        deckName: tag,
        medianPriority: Math.round(medianPriority),
        cardCount: tagCardUids.length,
      };
    }

    // 添加"未定义"牌组
    // TODO: 实现未定义牌组的逻辑
    newDeckPriorities['__undefined__'] = {
      deckName: '未定义',
      medianPriority: defaultPriority,
      cardCount: 0,
    };

    setDeckPriorities(newDeckPriorities);
    setIsLoading(false);
  }, [tagsList, cardUids, priorityOrder, allCardsCount, defaultPriority]);

  // 初始计算
  React.useEffect(() => {
    calculateDeckPriorities();
  }, [calculateDeckPriorities]);

  // 更新牌组优先级（调整该牌组所有卡片的优先级）
  const updateDeckPriority = React.useCallback((deckName: string, newPriority: number) => {
    // TODO: 实现批量更新逻辑
    // 1. 计算优先级偏移量
    // 2. 更新该牌组所有卡片的优先级
    // 3. 保存到 Roam
    
    console.log(`更新牌组 ${deckName} 的优先级到 ${newPriority}`);
    
    // 暂时只更新本地状态
    setDeckPriorities(prev => ({
      ...prev,
      [deckName]: {
        ...prev[deckName],
        medianPriority: newPriority,
      },
    }));
  }, []);

  return {
    deckPriorities,
    updateDeckPriority,
    isLoading,
  };
};

export default useDeckPriority; 