import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import PracticeOverlay from '~/components/overlay/PracticeOverlay';
import SidePannelWidget from '~/components/SidePanelWidget';
import practice from '~/practice';
import usePracticeData from '~/hooks/usePracticeData';
import useSettings from '~/hooks/useSettings';
import useCollapseReferenceList from '~/hooks/useCollapseReferenceList';
import useOnBlockInteract from '~/hooks/useOnBlockInteract';
import useCommandPaletteAction from '~/hooks/useCommandPaletteAction';
import useCachedData from '~/hooks/useCachedData';
import useOnVisibilityStateChange from '~/hooks/useOnVisibilityStateChange';
import useAllPages from '~/hooks/useAllPages';
import useDeckPriority from '~/hooks/useDeckPriority';
import { IntervalMultiplierType, ReviewModes } from '~/models/session';
import { RenderMode } from '~/models/practice';

export interface handlePracticeProps {
  refUid: string;
  grade: number;
  reviewMode: ReviewModes;
  intervalMultiplier: number;
  intervalMultiplierType: IntervalMultiplierType;
}

const App = () => {
  const [showPracticeOverlay, setShowPracticeOverlay] = React.useState(false);
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
    defaultPriority,
  });

  const { deckPriorities, isLoading: deckPrioritiesLoading } = useDeckPriority({
    tagsList,
    cardUids,
    priorityOrder,
    allCardsCount,
    defaultPriority,
  });

  const handleSetIsGlobalMixedMode = (mode: boolean) => {
    setSettings(s => ({ ...s, isGlobalMixedMode: mode }));
    window.roamMemo.extensionAPI.settings.set('isGlobalMixedMode', mode);
  };

  // 根据牌组优先级排序
  const sortedTagsList = React.useMemo(() => {
    if (!tagsList || tagsList.length === 0 || Object.keys(deckPriorities).length === 0) {
      return tagsList;
    }

    return [...tagsList].sort((a, b) => {
      const priorityA = deckPriorities[a]?.medianPriority ?? defaultPriority;
      const priorityB = deckPriorities[b]?.medianPriority ?? defaultPriority;
      return priorityB - priorityA; // 降序排列
    });
  }, [tagsList, deckPriorities, defaultPriority]);

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
    if (showPracticeOverlay) return;
    refreshData();
  });

  const onShowPracticeOverlay = () => {
    refreshData();
    setShowPracticeOverlay(true);
    setIsCramming(false);
  };

  const onClosePracticeOverlayCallback = () => {
    setShowPracticeOverlay(false);
    setIsCramming(false);
    refreshData();
  };

  const handleMemoTagChange = (tag) => {
    setSelectedTag(tag);
  };

  const handleReviewMoreClick = async () => {
    // @TODOZ: Handle this case.
    refreshData();
  };

  useCollapseReferenceList({ dataPageTitle });

  // Keep counters in sync as you add/remove tags from blocks
  const [tagsOnEnter, setTagsOnEnter] = React.useState<string[]>([]);
  const onBlockEnterHandler = (elm: HTMLTextAreaElement) => {
    const tags = tagsList.filter((tag) => elm.value.includes(tag));
    setTagsOnEnter(tags);
  };
  const onBlockLeaveHandler = (elm: HTMLTextAreaElement) => {
    // Don't refetch data if overlay is open (to avoid removing cards while editing)
    if (showPracticeOverlay) return;

    const tags = tagsList.filter((tag) => elm.value.includes(tag));

    if (tagsOnEnter.length !== tags.length) {
      fetchPracticeData();
    }
  };

  useOnBlockInteract({
    onEnterCallback: onBlockEnterHandler,
    onLeaveCallback: onBlockLeaveHandler,
  });

  useCommandPaletteAction({ onShowPracticeOverlay });

  return (
    <Blueprint.HotkeysProvider>
      <>
        <SidePannelWidget onClickCallback={onShowPracticeOverlay} today={today} />
        {showPracticeOverlay && (
          <PracticeOverlay
            isOpen={showPracticeOverlay}
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
            deckPriorities={deckPriorities}
            defaultPriority={defaultPriority}
            fsrsEnabled={fsrsEnabled}
            isGlobalMixedMode={isGlobalMixedMode}
            setIsGlobalMixedMode={handleSetIsGlobalMixedMode}
          />
        )}
      </>
    </Blueprint.HotkeysProvider>
  );
};

export default App;
