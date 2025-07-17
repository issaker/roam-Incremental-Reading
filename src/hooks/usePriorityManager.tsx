import * as React from 'react';
import { ArrayPriorityManager } from '~/utils/ArrayPriorityManager';
import { loadPriorityOrder, savePriorityOrder } from '~/queries/save';

interface UsePriorityManagerProps {
  cardUids: Record<string, string[]>;
  dataPageTitle: string;
  isEnabled: boolean;
}

interface UsePriorityManagerReturn {
  priorityManager: ArrayPriorityManager | null;
  isLoading: boolean;
  savePriority: () => Promise<void>;
  moveDeck: (deckName: string, direction: 'up' | 'down') => Promise<void>;
  moveCard: (uid: string, newPosition: number) => Promise<void>;
  getDeckPositions: () => { deckName: string; position: number; cardCount: number }[];
  getCardPosition: (uid: string) => number;
  getTotalCards: () => number;
}

export const usePriorityManager = ({
  cardUids,
  dataPageTitle,
  isEnabled
}: UsePriorityManagerProps): UsePriorityManagerReturn => {
  const [priorityManager, setPriorityManager] = React.useState<ArrayPriorityManager | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // 初始化优先级管理器
  React.useEffect(() => {
    if (!isEnabled) {
      setPriorityManager(null);
      setIsLoading(false);
      return;
    }

    const initializePriorityManager = async () => {
      try {
        setIsLoading(true);
        
        // 加载现有的优先级顺序 - 增强数据保护
        const existingOrder = await loadPriorityOrder({ dataPageTitle });
        
        // 获取所有卡片UID
        const allUids = Object.values(cardUids).flat();
        
        // 数据保护：如果没有现有数据或数据无效，不要创建管理器
        if (!existingOrder || !Array.isArray(existingOrder) || existingOrder.length === 0) {
          setPriorityManager(null);
          setIsLoading(false);
          return;
        }
        
        // 创建优先级管理器 - 仅使用已有数据
        const manager = new ArrayPriorityManager(existingOrder);
        
        // 获取现有卡片UID，避免无谓的修改
        const existingUids = new Set(manager.getSortedUids());
        const hasNewCards = allUids.some(uid => !existingUids.has(uid));
        const hasRemovedCards = manager.getSortedUids().some(uid => !allUids.includes(uid));
        
        if (hasNewCards || hasRemovedCards) {
          // 添加新卡片并清理不存在的卡片
          manager.addCards(allUids);
          manager.removeCards(allUids);
          
          // 只有在真正有变化时才保存
          if (manager.hasUnsavedChanges() && manager.getSortedUids().length > 0) {
            await savePriorityOrder({ 
              dataPageTitle, 
              priorityOrder: manager.getSortedUids() 
            });
            manager.markAsSaved();
          }
        }
        
        setPriorityManager(manager);
      } catch (error) {
        console.error('优先级管理器初始化失败:', error);
        setPriorityManager(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializePriorityManager();
  }, [cardUids, dataPageTitle, isEnabled]);

  // 保存优先级到数据库
  const savePriority = React.useCallback(async () => {
    if (!priorityManager) return;
    
    try {
      await savePriorityOrder({ 
        dataPageTitle, 
        priorityOrder: priorityManager.getSortedUids() 
      });
      priorityManager.markAsSaved();
    } catch (error) {
      console.error('保存优先级失败:', error);
      throw error;
    }
  }, [priorityManager, dataPageTitle]);

  // 移动牌组位置
  const moveDeck = React.useCallback(async (deckName: string, direction: 'up' | 'down') => {
    if (!priorityManager) return;
    
    const deckUids = cardUids[deckName] || [];
    if (deckUids.length === 0) return;
    
    const currentOrder = priorityManager.getSortedUids();
    const firstCardIndex = currentOrder.findIndex(uid => deckUids.includes(uid));
    if (firstCardIndex === -1) return;
    
    // 找到所有牌组卡片在当前顺序中的位置
    const deckCardIndices = deckUids.map(uid => currentOrder.indexOf(uid)).filter(idx => idx !== -1).sort((a, b) => a - b);
    
    let newIndex: number;
    if (direction === 'up') {
      // 向上移动：移动到第一张卡片的前一个位置
      newIndex = Math.max(0, deckCardIndices[0] - 1);
    } else {
      // 向下移动：移动到最后一张卡片的后一个位置
      newIndex = Math.min(currentOrder.length - deckUids.length, deckCardIndices[deckCardIndices.length - 1] + 1);
    }
    
    priorityManager.moveDeck(deckUids, newIndex);
    await savePriority();
  }, [priorityManager, cardUids, savePriority]);

  // 移动单张卡片位置
  const moveCard = React.useCallback(async (uid: string, newPosition: number) => {
    if (!priorityManager) return;
    
    const targetIndex = Math.max(0, Math.min(priorityManager.getSortedUids().length - 1, newPosition - 1));
    priorityManager.moveCard(uid, targetIndex);
    await savePriority();
  }, [priorityManager, savePriority]);

  // 获取牌组位置信息
  const getDeckPositions = React.useCallback(() => {
    if (!priorityManager) return [];
    return priorityManager.getDeckPositions(cardUids);
  }, [priorityManager, cardUids]);

  // 获取卡片位置
  const getCardPosition = React.useCallback((uid: string) => {
    if (!priorityManager) return 1;
    return priorityManager.getCardPosition(uid);
  }, [priorityManager]);

  // 获取总卡片数
  const getTotalCards = React.useCallback(() => {
    if (!priorityManager) return 0;
    return priorityManager.getSortedUids().length;
  }, [priorityManager]);

  return {
    priorityManager,
    isLoading,
    savePriority,
    moveDeck,
    moveCard,
    getDeckPositions,
    getCardPosition,
    getTotalCards
  };
};