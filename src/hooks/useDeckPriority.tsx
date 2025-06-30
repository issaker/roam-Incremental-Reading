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
  const [isLoading, setIsLoading] = React.useState(true);

  const deckPriorities = React.useMemo(() => {
    if (!priorityOrder) {
      setIsLoading(true);
      return {};
    }

    setIsLoading(true);
    try {
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

        const priorities: number[] = tagCardUids.map(uid => {
          const cardRank = getCardRank({
            refUid: uid,
            priorityOrder,
            allCardsCount,
            defaultPriority,
          });
          // 将排名转换为优先级百分比（1 = 100%, allCardsCount = 0%）
          return Math.round((1 - (cardRank - 1) / Math.max(1, allCardsCount - 1)) * 100);
        });

        const medianPriority = calculateMedian(priorities);
        
        newDeckPriorities[tag] = {
          deckName: tag,
          medianPriority: Math.round(medianPriority),
          cardCount: tagCardUids.length,
        };
      }
      return newDeckPriorities;
    } catch (error) {
      console.error('Error calculating deck priorities:', error);
      return {};
    } finally {
      setIsLoading(false);
    }
  }, [tagsList, cardUids, priorityOrder, allCardsCount, defaultPriority]);

  // 更新牌组优先级（调整该牌组所有卡片的优先级）
  const updateDeckPriority = React.useCallback((deckName: string, newPriority: number) => {
    console.log(`更新牌组 ${deckName} 的优先级到 ${newPriority}`);
    
    // 暂时只更新本地状态
    // setDeckPriorities(prev => ({
    //   ...prev,
    //   [deckName]: {
    //     ...prev[deckName],
    //     medianPriority: newPriority,
    //   },
    // }));
  }, []);

  return {
    deckPriorities,
    updateDeckPriority,
    isLoading,
  };
};

export default useDeckPriority; 