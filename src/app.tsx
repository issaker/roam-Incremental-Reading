import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import PracticeOverlay from '~/components/overlay/PracticeOverlay';
import StateShell from '~/components/StateShell';
import UnifiedDialog from '~/components/UnifiedDialog';
import SidePannelWidget from '~/components/SidePanelWidget';
import practice from '~/practice';
import usePracticeData from '~/hooks/usePracticeData';
import useSettings from '~/hooks/useSettings';
import useOnBlockInteract from '~/hooks/useOnBlockInteract';
import useCommandPaletteAction from '~/hooks/useCommandPaletteAction';
import useCachedData from '~/hooks/useCachedData';
import useOnVisibilityStateChange from '~/hooks/useOnVisibilityStateChange';
import useAllPages from '~/hooks/useAllPages';
import { usePriorityManager } from '~/hooks/usePriorityManager';
import { IntervalMultiplierType, ReviewModes } from '~/models/session';
import { RenderMode } from '~/models/practice';

export interface handlePracticeProps {
  refUid: string;
  grade: number;
  reviewMode: ReviewModes;
  intervalMultiplier: number;
  intervalMultiplierType: IntervalMultiplierType;
}

// 定义 Dialog 状态类型
type DialogState = 'closed' | 'loading' | 'practice' | 'saving';

const App = () => {
  const [dialogState, setDialogState] = React.useState<DialogState>('closed');
  const [isCramming, setIsCramming] = React.useState(false);
  const [selectedTag, setSelectedTag] = React.useState<string>('');

  const [settings, setSettings] = useSettings();
  const { dataPageTitle, dailyLimit, defaultPriority, fsrsEnabled, isGlobalMixedMode } = settings;
  
  // 使用 useAllPages 获取所有页面作为牌组
  const { allPages: tagsList, isLoading: pagesLoading, refreshPages } = useAllPages({ 
    dataPageTitle 
  });

  // 🔧 修复：确保selectedTag始终在当前tagsList中
  const safeSelectedTag = React.useMemo(() => {
    if (tagsList.length === 0) return '';
    if (tagsList.includes(selectedTag)) return selectedTag;
    return tagsList[0];
  }, [selectedTag, tagsList]);

  // 当safeSelectedTag改变时，同步更新selectedTag
  // 并处理 tagsList 第一次加载后的情况
  React.useEffect(() => {
    if (safeSelectedTag && (safeSelectedTag !== selectedTag || !selectedTag)) {
      setSelectedTag(safeSelectedTag);
    }
  }, [safeSelectedTag, selectedTag, setSelectedTag]);

  const { fetchCacheData, saveCacheData, data: cachedData } = useCachedData({ dataPageTitle });

  const { practiceData, today, fetchPracticeData, allCardsCount, priorityOrder, allCardUids, cardUids } = usePracticeData({
    tagsList,
    selectedTag: safeSelectedTag,
    dataPageTitle,
    cachedData,
    isCramming,
    dailyLimit,
    isGlobalMixedMode,
    defaultPriority,
  });

  const { priorityManager, isLoading: priorityLoading, moveDeck, moveCard, getDeckPositions, getCardPosition, getTotalCards } = usePriorityManager({
    cardUids,
    dataPageTitle,
    isEnabled: dialogState !== 'closed' // 只在插件窗口打开时启用优先级管理
  });

  const handleSetIsGlobalMixedMode = (mode: boolean) => {
    setSettings(s => ({ ...s, isGlobalMixedMode: mode }));
    window.roamMemo.extensionAPI.settings.set('isGlobalMixedMode', mode);
  };

  // 根据优先级管理器排序牌组
  const sortedTagsList = React.useMemo(() => {
    if (!tagsList || tagsList.length === 0 || !priorityManager) {
      return tagsList;
    }

    const deckPositions = getDeckPositions();
    if (deckPositions.length === 0) {
      return tagsList;
    }

    return deckPositions.map(deck => deck.deckName);
  }, [tagsList, priorityManager, getDeckPositions]);

  const handlePracticeClick = async ({ refUid, ...cardData }: handlePracticeProps) => {
    if (!refUid) {
      console.error('HandlePracticeFn Error: No refUid provided');
      return;
    }

    try {
      const practiceParams = {
        ...cardData,
        dataPageTitle,
        dateCreated: new Date(),
        refUid,
        isCramming,
        fsrsEnabled, // 传递算法选择
      };
      
      await practice(practiceParams);
    } catch (error) {
      console.error('Error Saving Practice Data', error);
    }
  };

  const setRenderMode = (tag: string, mode: RenderMode) => {
    saveCacheData({ renderMode: mode }, { selectedTag: tag });
    fetchCacheData();
  };

  const refreshData = () => {
    fetchCacheData();
    fetchPracticeData();
  };

  useOnVisibilityStateChange(() => {
    // 只在插件窗口打开时才需要刷新数据
    if (dialogState === 'closed' || dialogState === 'practice') return;
    refreshData();
  });

  const onShowPracticeOverlay = () => {
    // 1. 立即显示加载界面
    setDialogState('loading');
    setIsCramming(false);
    
    // 2. 异步加载数据并切换到主界面
    setTimeout(() => {
      refreshData();
      setDialogState('practice');
    }, 0);
  };

  const onClosePracticeOverlayCallback = () => {
    // 1. 立即切换到保存界面
    setDialogState('saving');
    setIsCramming(false);
    
    // 2. 异步保存数据
    setTimeout(() => {
      refreshData();
      setDialogState('closed');
    }, 500); // 给一点时间让用户看到保存提示
  };

  const handleMemoTagChange = (tag) => {
    setSelectedTag(tag);
  };

  const handleReviewMoreClick = async () => {
    // @TODOZ: Handle this case.
    refreshData();
  };


  // Keep counters in sync as you add/remove tags from blocks
  const [tagsOnEnter, setTagsOnEnter] = React.useState<string[]>([]);
  const onBlockEnterHandler = (elm: HTMLTextAreaElement) => {
    const tags = tagsList.filter((tag) => elm.value.includes(tag));
    setTagsOnEnter(tags);
  };
  const onBlockLeaveHandler = (elm: HTMLTextAreaElement) => {
    // Don't refetch data if overlay is open (to avoid removing cards while editing)
    if (dialogState === 'practice') return;

    const tags = tagsList.filter((tag) => elm.value.includes(tag));

    if (tagsOnEnter.length !== tags.length) {
      fetchPracticeData();
    }
  };

  // 只在插件主窗口打开时启用块交互监听，避免影响正常使用性能
  useOnBlockInteract({
    onEnterCallback: onBlockEnterHandler,
    onLeaveCallback: onBlockLeaveHandler,
    enabled: dialogState === 'practice', // 只在练习窗口打开时启用
  });

  useCommandPaletteAction({ onShowPracticeOverlay });


  return (
    <Blueprint.HotkeysProvider>
      <>
        <SidePannelWidget onClickCallback={onShowPracticeOverlay} today={today} />
        
        {/* 统一 Dialog 管理，根据状态切换内容 */}
        <UnifiedDialog 
          isOpen={dialogState !== 'closed'} 
          onClose={onClosePracticeOverlayCallback}
        >
          {dialogState === 'loading' && (
            <StateShell state="loading" onClose={onClosePracticeOverlayCallback} />
          )}
          
          {dialogState === 'saving' && (
            <StateShell state="saving" onClose={() => setDialogState('closed')} showForceClose />
          )}
          
          {dialogState === 'practice' && (
            <PracticeOverlay
              isOpen={dialogState === 'practice'}
              onCloseCallback={onClosePracticeOverlayCallback}
              practiceData={practiceData}
              today={today}
              handlePracticeClick={handlePracticeClick}
              tagsList={sortedTagsList}
              selectedTag={safeSelectedTag}
              handleMemoTagChange={setSelectedTag}
              handleReviewMoreClick={() => {}}
              isCramming={isCramming}
              setIsCramming={setIsCramming}
              setRenderMode={setRenderMode}
              dataPageTitle={dataPageTitle}
              onDataRefresh={refreshData}
              allCardsCount={allCardsCount}
              priorityOrder={priorityOrder}
              allCardUids={allCardUids}
              cardUids={cardUids}
              defaultPriority={defaultPriority}
              fsrsEnabled={fsrsEnabled}
              isGlobalMixedMode={isGlobalMixedMode}
              setIsGlobalMixedMode={handleSetIsGlobalMixedMode}
              priorityManager={priorityManager}
              moveCard={moveCard}
              getCardPosition={getCardPosition}
              getTotalCards={getTotalCards}
              getDeckPositions={getDeckPositions}
              moveDeck={moveDeck}
            />
          )}
        </UnifiedDialog>
      </>
    </Blueprint.HotkeysProvider>
  );
};

export default App;
