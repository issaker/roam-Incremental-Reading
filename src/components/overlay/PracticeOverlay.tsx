import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import * as BlueprintSelect from '@blueprintjs/select';
import styled from '@emotion/styled';
import useBlockInfo from '~/hooks/useBlockInfo';
import * as asyncUtils from '~/utils/async';
import * as dateUtils from '~/utils/date';
import * as stringUtils from '~/utils/string';
import Lottie from 'react-lottie';
import doneAnimationData from '~/lotties/done.json';
import Tooltip from '~/components/Tooltip';
import mediaQueries from '~/utils/mediaQueries';
import { useZIndexFix } from '~/hooks/useZIndexFix';
import { useFocusFix } from '~/hooks/useFocusFix';

import CardBlock from '~/components/overlay/CardBlock';
import Footer from '~/components/overlay/Footer';
import ButtonTags from '~/components/ButtonTags';
import DeckManager from '~/components/DeckManager';
import PrioritySlider from '~/components/PrioritySlider';
import CardDotMatrixManager from '~/components/CardDotMatrixManager';
import { CompleteRecords, IntervalMultiplierType, ReviewModes } from '~/models/session';
import useCurrentCardData from '~/hooks/useCurrentCardData';
import { generateNewSession } from '~/queries';
import { CompletionStatus, Today, RenderMode } from '~/models/practice';
import { handlePracticeProps } from '~/app';
import { useSafeContext } from '~/hooks/useSafeContext';

interface MainContextProps {
  reviewMode: ReviewModes | undefined;
  setReviewModeOverride: React.Dispatch<React.SetStateAction<ReviewModes | undefined>>;
  intervalMultiplier: number;
  setIntervalMultiplier: (multiplier: number) => void;
  intervalMultiplierType: IntervalMultiplierType;
  setIntervalMultiplierType: (type: IntervalMultiplierType) => void;
  onPracticeClick: (props: handlePracticeProps) => void;
  today: Today;
  selectedTag: string;
  currentIndex: number;
  renderMode: RenderMode;
  setRenderMode: (tag: string, mode: RenderMode) => void;
}

export const MainContext = React.createContext<MainContextProps>({} as MainContextProps);

interface Props {
  isOpen: boolean;
  tagsList: string[];
  selectedTag: string;
  onCloseCallback: () => void;
  practiceData: CompleteRecords;
  today: Today;
  handlePracticeClick: (props: handlePracticeProps) => void;
  handleMemoTagChange: (tag: string) => void;
  handleReviewMoreClick: () => void;
  isCramming: boolean;
  setIsCramming: (isCramming: boolean) => void;
  setRenderMode: (tag: string, mode: RenderMode) => void;
  dataPageTitle: string;
  onDataRefresh: () => void;
  allCardsCount: number;
  priorityOrder: string[];
  allCardUids: string[];
  cardUids: Record<string, string[]>;
  defaultPriority: number;
  fsrsEnabled: boolean;
  isGlobalMixedMode: boolean;
  setIsGlobalMixedMode: (mode: boolean) => void;
  priorityManager?: any;
  moveCard?: (uid: string, newPosition: number) => Promise<void>;
  getCardPosition?: (uid: string) => number;
  getTotalCards?: () => number;
  getDeckPositions?: () => { deckName: string; position: number; cardCount: number }[];
  moveDeck?: (deckName: string, direction: 'up' | 'down') => Promise<void>;
}

const PracticeOverlay = ({
  isOpen,
  tagsList,
  selectedTag,
  onCloseCallback,
  practiceData,
  today,
  handlePracticeClick,
  handleMemoTagChange,
  handleReviewMoreClick,
  isCramming,
  setIsCramming,
  setRenderMode,
  dataPageTitle,
  onDataRefresh,
  allCardsCount,
  priorityOrder,
  allCardUids,
  cardUids,
  defaultPriority,
  fsrsEnabled,
  isGlobalMixedMode,
  setIsGlobalMixedMode,
  priorityManager,
  moveCard,
  getCardPosition,
  getTotalCards,
  getDeckPositions,
  moveDeck,
}: Props) => {
  // 🚀 移除内部加载状态，由外部 LoadingShell 统一处理
  
  const todaySelectedTag = (today && today.tags && today.tags[selectedTag]) || { completed: 0, dueUids: [], newUids: [] };
  const completedTodayCount = todaySelectedTag.completed;
  
  // 🚀 修改：根据混合学习模式生成不同的练习队列
  const practiceCardUids = React.useMemo(() => {
    let cardUidsToPractice: string[] = [];

    try {
      if (isGlobalMixedMode && tagsList && today && today.tags) {
        // 全局混合模式：从所有牌组收集卡片
        cardUidsToPractice = tagsList.flatMap(tag => {
          const tagData = today.tags[tag];
          return tagData ? [...(tagData.dueUids || []), ...(tagData.newUids || [])] : [];
        });
        // 去重
        cardUidsToPractice = [...new Set(cardUidsToPractice)];
      } else {
        // 单牌组模式：仅显示当前选中牌组的卡片
        cardUidsToPractice = [...(todaySelectedTag.dueUids || []), ...(todaySelectedTag.newUids || [])];
      }
    } catch (error) {
      console.error('生成练习卡片列表时出错:', error);
      cardUidsToPractice = [];
    }
    
    // 使用新的统一优先级管理器进行排序
    if (priorityManager) {
      return priorityManager.getSortedUids().filter(uid => cardUidsToPractice.includes(uid));
    }
    
    // 降级处理：使用旧的排序逻辑
    if (priorityOrder.length > 0) {
      const rankMap = new Map(priorityOrder.map((uid, i) => [uid, i]));
      const getRank = (uid: string) => rankMap.get(uid) ?? Number.MAX_SAFE_INTEGER;
      return cardUidsToPractice.sort((a, b) => getRank(a) - getRank(b));
    }
    
    return cardUidsToPractice;
  }, [isGlobalMixedMode, tagsList, today.tags, todaySelectedTag.dueUids, todaySelectedTag.newUids, priorityManager, priorityOrder]);


  const renderMode = todaySelectedTag.renderMode;

  const [currentIndex, setCurrentIndex] = React.useState(0);

  // 🐛 修复：模式切换时重置currentIndex
  React.useEffect(() => {
    setCurrentIndex(0);
  }, [isGlobalMixedMode, selectedTag]);

  // 🚀 简单的倒计时实现 - 插队到当前队列
  const timersRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [practiceCardUidsState, setPracticeCardUidsState] = React.useState<string[]>([]);
  
  // 初始化队列状态
  React.useEffect(() => {
    setPracticeCardUidsState(practiceCardUids);
  }, [practiceCardUids.join(',')]);
  
  // 清理所有定时器
  const clearAllTimers = React.useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  // 组件卸载时清理定时器
  React.useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // 窗口关闭时清理定时器
  React.useEffect(() => {
    if (!isOpen) {
      clearAllTimers();
    }
  }, [isOpen, clearAllTimers]);

  // 卡片到期插队函数
  const insertCardToQueue = React.useCallback((cardUid: string) => {
    setPracticeCardUidsState(current => {
      // 检查卡片是否已经在队列中
      if (current.includes(cardUid)) {
        // 如果已经在队列中，移到当前位置后面
        const filtered = current.filter(uid => uid !== cardUid);
        const insertIndex = Math.min(currentIndex + 1, filtered.length);
        const newQueue = [...filtered];
        newQueue.splice(insertIndex, 0, cardUid);
        return newQueue;
      } else {
        // 如果不在队列中，插入到当前位置后面
        const insertIndex = Math.min(currentIndex + 1, current.length);
        const newQueue = [...current];
        newQueue.splice(insertIndex, 0, cardUid);
        return newQueue;
      }
    });
  }, [currentIndex]);

  const actualPracticeCardUids = practiceCardUidsState;

  const isFirst = currentIndex === 0;

  // 🚀 直接提供 currentCardRefUid，无需等待初始化
  const currentCardRefUid = actualPracticeCardUids[currentIndex] as string | undefined;

  const sessions = React.useMemo(() => {
    return currentCardRefUid ? practiceData[currentCardRefUid] || [] : [];
  }, [currentCardRefUid, practiceData]);
  const { currentCardData, reviewMode, setReviewModeOverride } = useCurrentCardData({
    currentCardRefUid,
    sessions,
  });

  // 🐛 修复：在全局混合模式下，hasCards应该基于实际的练习队列而非单个牌组
  const totalCardsCount = isGlobalMixedMode 
    ? actualPracticeCardUids.length 
    : todaySelectedTag.new + todaySelectedTag.due;
  const hasCards = totalCardsCount > 0;
  
  const isDone = (isGlobalMixedMode 
    ? actualPracticeCardUids.length === 0 
    : todaySelectedTag.status === CompletionStatus.Finished) || !currentCardData;

  const newFixedSessionDefaults = React.useMemo(
    () => generateNewSession({ reviewMode: ReviewModes.FixedInterval }),
    []
  );
  const [intervalMultiplier, setIntervalMultiplier] = React.useState<number>(
    currentCardData?.intervalMultiplier || (newFixedSessionDefaults.intervalMultiplier as number)
  );
  const [intervalMultiplierType, setIntervalMultiplierType] =
    React.useState<IntervalMultiplierType>(
      currentCardData?.intervalMultiplierType ||
        (newFixedSessionDefaults.intervalMultiplierType as IntervalMultiplierType)
    );

  // 牌组优先级管理
  const [showDeckPriorityManager, setShowDeckPriorityManager] = React.useState(false);
  
  // 处理优先级更新
  const handlePriorityUpdate = React.useCallback(async (newPriorityOrder: string[]) => {
    try {
      // 使用静态导入，与usePriorityManager.tsx相同的方式
      const saveModule = await import('~/queries/save');
      const { savePriorityOrder } = saveModule;
      
      if (typeof savePriorityOrder === 'function') {
        await savePriorityOrder({ 
          dataPageTitle, 
          priorityOrder: newPriorityOrder 
        });
        
        // 刷新数据
        onDataRefresh();
      } else {
        throw new Error('savePriorityOrder函数不可用');
      }
    } catch (error) {
      console.error('更新优先级失败:', error);
    }
  }, [dataPageTitle, onDataRefresh]);

  // When card changes, update multiplier state
  React.useEffect(() => {
    if (!currentCardData) return;

    if (currentCardData?.reviewMode === ReviewModes.FixedInterval) {
      // If card has multiplier, use that
      setIntervalMultiplier(currentCardData.intervalMultiplier as number);
      setIntervalMultiplierType(currentCardData.intervalMultiplierType as IntervalMultiplierType);
    } else {
      // Otherwise, just reset to default
      setIntervalMultiplier(newFixedSessionDefaults.intervalMultiplier as number);
      setIntervalMultiplierType(
        newFixedSessionDefaults.intervalMultiplierType as IntervalMultiplierType
      );
    }
  }, [currentCardData, newFixedSessionDefaults]);

  const hasNextDueDate = currentCardData && 'nextDueDate' in currentCardData;
  const isNew = currentCardData && 'isNew' in currentCardData && currentCardData.isNew;
  const nextDueDate = hasNextDueDate ? currentCardData.nextDueDate : undefined;

  const isDueToday = dateUtils.daysBetween(nextDueDate, new Date()) === 0;
  const status = isNew ? 'new' : isDueToday ? 'dueToday' : hasNextDueDate ? 'pastDue' : null;

  // 🚀 只有在初始化完成后才获取 blockInfo
  const { blockInfo, isLoading: blockInfoLoading, refreshBlockInfo } = useBlockInfo({ 
    refUid: currentCardRefUid 
  });
  const hasBlockChildren = !!blockInfo.children && !!blockInfo.children.length;
  const hasBlockChildrenUids = !!blockInfo.childrenUids && !!blockInfo.childrenUids.length;

  // 🚀 P1: 预取下一张卡片的 blockInfo，提升用户体验
  const nextCardRefUid = actualPracticeCardUids[currentIndex + 1];
  const { blockInfo: nextBlockInfo } = useBlockInfo({ 
    refUid: nextCardRefUid
  });

  const [showAnswers, setShowAnswers] = React.useState(false);
  const [hasCloze, setHasCloze] = React.useState(true);

  const shouldShowAnswerFirst =
    renderMode === RenderMode.AnswerFirst && hasBlockChildrenUids && !showAnswers;

  // 卡片切换时重置答案显示状态
  React.useEffect(() => {
    setShowAnswers(false);
  }, [currentCardRefUid]);

  // 自动显示答案（无子块且无cloze）
  React.useEffect(() => {
    if (currentCardRefUid && !blockInfoLoading) {
      const shouldAutoShow = !hasBlockChildren && !hasBlockChildrenUids && !hasCloze;
      if (shouldAutoShow && !showAnswers) {
        const timer = setTimeout(() => setShowAnswers(true), 100);
        return () => clearTimeout(timer);
      }
    }
  }, [currentCardRefUid, hasBlockChildren, hasBlockChildrenUids, hasCloze, blockInfoLoading, showAnswers]);

  const onTagChange = async (tag) => {
    setCurrentIndex(0);
    handleMemoTagChange(tag);
    setIsCramming(false);

    // 🚀 新增：用户选择牌组时自动切换到单组模式
    // 避免用户忘记当前模式导致的困惑
    if (isGlobalMixedMode) {
      setIsGlobalMixedMode(false);
    }

    // To prevent 'space' key event from triggering dropdown
    await asyncUtils.sleep(100);

    if (document.activeElement instanceof HTMLElement) {
      document?.activeElement.blur();
    }
  };

  // When practice queue changes, reset current index
  const previousQueueLength = React.useRef(actualPracticeCardUids.length);
  
  React.useEffect(() => {
    // 只在队列长度变化时重置索引
    if (actualPracticeCardUids.length !== previousQueueLength.current) {
      setCurrentIndex(0);
      previousQueueLength.current = actualPracticeCardUids.length;
    }
  }, [actualPracticeCardUids.length]);

  const onPracticeClick = React.useCallback(
    (gradeData) => {
      if (isDone) return;
      
      const practiceProps = {
        ...currentCardData,
        ...gradeData,
        intervalMultiplier,
        intervalMultiplierType,
      };

      const afterPractice = async () => {
        try {
          await handlePracticeClick(practiceProps);
          
          // 🚀 简单的倒计时逻辑
          if (fsrsEnabled && currentCardRefUid) {
            try {
              // 计算下次复习时间
              const fsrsModule = await import('~/algorithms/fsrs');
              const fsrsResult = fsrsModule.fsrsAlgorithm(practiceProps, gradeData.grade);
              
              if (fsrsResult.fsrsState && fsrsResult.fsrsState.due) {
                const dueTimestamp = new Date(fsrsResult.fsrsState.due).getTime();
                const now = Date.now();
                const delay = dueTimestamp - now;
                
                // 如果是当天内需要复习的卡片（24小时内）
                if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
                  // 清理该卡片的旧定时器
                  const existingTimer = timersRef.current.get(currentCardRefUid);
                  if (existingTimer) {
                    clearTimeout(existingTimer);
                  }
                  
                  // 先从当前队列中移除这张卡片（避免重复）
                  setPracticeCardUidsState(current => 
                    current.filter(uid => uid !== currentCardRefUid)
                  );
                  
                  // 设置新的定时器
                  const timer = setTimeout(() => {
                    timersRef.current.delete(currentCardRefUid);
                    // 插队到当前位置后面，成为下一张卡片
                    insertCardToQueue(currentCardRefUid);
                  }, delay);
                  
                  timersRef.current.set(currentCardRefUid, timer);
                }
              }
            } catch (error) {
              console.error('倒计时设置失败:', error);
            }
          }
        } catch (error) {
          console.error('练习数据保存失败:', error);
        }
      };
      
      afterPractice();
      setCurrentIndex(currentIndex + 1);
    },
    [
      handlePracticeClick,
      isDone,
      currentIndex,
      currentCardData,
      intervalMultiplier,
      intervalMultiplierType,
      fsrsEnabled,
      currentCardRefUid,
    ]
  );

  const onSkipClick = React.useCallback(() => {
    if (isDone) return;
    setCurrentIndex(currentIndex + 1);
  }, [currentIndex, isDone]);

  const onPrevClick = React.useCallback(() => {
    if (isFirst) return;

    setCurrentIndex(currentIndex - 1);
  }, [currentIndex, isFirst]);

  const onStartCrammingClick = () => {
    // Refresh data to apply any priority changes before starting cramming
    onDataRefresh();
    setIsCramming(true);
    setCurrentIndex(0);
  };

  const lottieAnimationOption = {
    loop: true,
    autoplay: true,
    animationData: doneAnimationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };
  const lottieStyle = {
    height: 200,
    width: 'auto',
  };

  const [showBreadcrumbs, setShowBreadcrumbs] = React.useState(true);
  const hotkeys = React.useMemo(
    () => [
      {
        combo: 'B',
        global: true,
        label: 'Show BreadCrumbs',
        onKeyDown: () => setShowBreadcrumbs(!showBreadcrumbs),
      },
    ],
    [showBreadcrumbs]
  );
  Blueprint.useHotkeys(hotkeys);

  // 层级管理：当弹窗打开时注入CSS修复，关闭时移除
  useZIndexFix(isOpen);
  // 🔧 焦点保护：窗口打开时启用
  useFocusFix(isOpen);


  // 🚀 CLEANUP: 移除本地计算的 globalStats，改用来自 usePracticeData 的 today.combinedToday，它是经过后端去重处理的唯一数据源
  const queueLength = actualPracticeCardUids ? actualPracticeCardUids.length : 0;

  return (
    <MainContext.Provider
      value={{
        reviewMode,
        setReviewModeOverride,
        intervalMultiplier,
        setIntervalMultiplier,
        intervalMultiplierType,
        setIntervalMultiplierType,
        onPracticeClick,
        today,
        selectedTag,
        currentIndex,
        renderMode,
        setRenderMode,
      }}
    >
      {/* 现在只是内容，不包含 Dialog */}
      <DialogContent>
        <Header
          className="bp3-dialog-header outline-none focus:outline-none focus-visible:outline-none"
          tagsList={tagsList}
          onCloseCallback={onCloseCallback}
          onTagChange={onTagChange}
          status={status}
          isDone={isDone}
          nextDueDate={nextDueDate}
          showBreadcrumbs={showBreadcrumbs}
          setShowBreadcrumbs={setShowBreadcrumbs}
          isCramming={isCramming}
          practiceCardUids={actualPracticeCardUids}
          onOpenDeckPriority={() => setShowDeckPriorityManager(true)}
          isGlobalMixedMode={isGlobalMixedMode}
          setIsGlobalMixedMode={setIsGlobalMixedMode}
        />

        <DialogBody
          className="bp3-dialog-body overflow-y-scroll m-0 pt-6 pb-8 px-4"
        >
          {currentCardRefUid ? (
            <>
              {shouldShowAnswerFirst ? (
                blockInfo.childrenUids?.map((uid) => (
                  <CardBlock
                    key={uid}
                    refUid={uid}
                    showAnswers={showAnswers}
                    setHasCloze={setHasCloze}
                    breadcrumbs={blockInfo.breadcrumbs}
                    showBreadcrumbs={false}
                  />
                ))
              ) : (
                <CardBlock
                  refUid={currentCardRefUid}
                  showAnswers={showAnswers}
                  setHasCloze={setHasCloze}
                  breadcrumbs={blockInfo.breadcrumbs}
                  showBreadcrumbs={showBreadcrumbs}
                />
              )}
            </>
          ) : (
            <div data-testid="practice-overlay-done-state" className="flex items-center flex-col">
              <Lottie options={lottieAnimationOption} style={lottieStyle} />
              {/* @TODOZ: Add support for review more*/}
              {/* eslint-disable-next-line no-constant-condition */}
              {false ? (
                <div>
                  Reviewed {todaySelectedTag.completed}{' '}
                  {stringUtils.pluralize(completedTodayCount, 'card', 'cards')} today.{' '}
                  <a onClick={handleReviewMoreClick}>Review more</a>
                </div>
              ) : (
                <div>
                  You&apos;re all caught up! 🌟{' '}
                  {todaySelectedTag.completed > 0
                    ? `Reviewed ${todaySelectedTag.completed} ${stringUtils.pluralize(
                        todaySelectedTag.completed,
                        'card',
                        'cards'
                      )} today.`
                    : ''}
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <Footer
          refUid={currentCardRefUid}
          onPracticeClick={onPracticeClick}
          onSkipClick={onSkipClick}
          onPrevClick={onPrevClick}
          setShowAnswers={setShowAnswers}
          showAnswers={showAnswers}
          isDone={isDone}
          hasCards={hasCards}
          onCloseCallback={onCloseCallback}
          currentCardData={currentCardData}
          onStartCrammingClick={onStartCrammingClick}
          fsrsEnabled={fsrsEnabled}
        />
        {/* 优先级滑块 - 只在有卡片且未完成时显示 */}
        {!isDone && hasCards && currentCardRefUid && moveCard && getCardPosition && getTotalCards && (
          <PrioritySlider
            currentPosition={getCardPosition(currentCardRefUid)}
            totalCards={getTotalCards()}
            onPositionChange={async (newPosition) => {
              await moveCard(currentCardRefUid, newPosition);
              onDataRefresh(); // 刷新数据以反映更改
            }}
            disabled={false}
          />
        )}
      </DialogContent>
      
      {/* 牌组优先级管理器 - 点阵图 */}
      <CardDotMatrixManager
        isOpen={showDeckPriorityManager}
        onClose={() => setShowDeckPriorityManager(false)}
        practiceData={practiceData}
        cardUids={cardUids}
        priorityOrder={priorityOrder}
        today={today}
        tagsList={tagsList}
        selectedTag={selectedTag}
        onTagSelect={handleMemoTagChange}
        onPriorityUpdate={handlePriorityUpdate}
      />
    </MainContext.Provider>
  );
};

const DialogContent = styled.div`
  display: grid;
  grid-template-rows: 50px 1fr auto;
  height: 100%;
  width: 100%;
`;


const DialogBody = styled.div`
  overflow-x: hidden; // because of tweaks we do in ContentWrapper container overflows
  min-height: 200px;
`;

const HeaderWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #5c7080;
  background-color: #f6f9fd;
  box-shadow: 0 1px 0 rgb(16 22 26 / 10%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-wrap: normal;
  line-height: inherit;
  margin: 0;
  min-height: 50px;
  padding: 0 16px;

  /* Shortcut way to tag selector color */
  & .bp3-button {
    color: #5c7080;
  }

  /* 📱 Portrait: 转为两行布局，避免元素挤压 */
  ${mediaQueries.mobilePortrait} {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    min-height: auto;

    & > div:first-of-type,
    & > div:last-of-type {
      width: 100%;
      display: flex;
      flex-wrap: nowrap;
      justify-content: space-between;
      align-items: center;
    }

    & span[data-testid='display-count-current'],
    & span[data-testid='display-count-total'] {
      font-size: 0.75rem;
    }
  }
`;

const TagSelector = ({ tagsList, selectedTag, onTagChange }) => {
  // 自定义过滤函数，支持中文和拼音搜索
  const filterTag = (query: string, tag: string) => {
    const normalizedQuery = query.toLowerCase();
    const normalizedTag = tag.toLowerCase();
    return normalizedTag.includes(normalizedQuery);
  };

  // 自定义输入框渲染
  const inputRenderer = (query: string, handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void) => (
    <Blueprint.InputGroup
      leftIcon="search"
      placeholder="搜索牌组..."
      value={query}
      onChange={handleChange}
      autoFocus
    />
  );

  return (
    // @ts-ignore
    <BlueprintSelect.Select
      items={tagsList}
      activeItem={selectedTag}
      filterable={true}
      itemPredicate={filterTag}
      inputProps={{ placeholder: "搜索牌组..." }}
      itemRenderer={(tag, { handleClick, modifiers, query }) => {
        // 高亮匹配的部分
        const index = tag.toLowerCase().indexOf(query.toLowerCase());
        if (query && index >= 0) {
          const before = tag.substring(0, index);
          const match = tag.substring(index, index + query.length);
          const after = tag.substring(index + query.length);
          
          return (
            <TagSelectorItem
              text={
                <span>
                  {before}
                  <strong style={{ color: '#106ba3' }}>{match}</strong>
                  {after}
                </span>
              }
              originalText={tag}
              tagsList={tagsList}
              active={modifiers.active}
              key={tag}
              onClick={handleClick}
            />
          );
        }
        
        return (
          <TagSelectorItem
            text={tag}
            originalText={tag}
            tagsList={tagsList}
            active={modifiers.active}
            key={tag}
            onClick={handleClick}
          />
        );
      }}
      onItemSelect={(tag) => {
        onTagChange(tag);
      }}
      popoverProps={{ 
        minimal: true,
        popoverClassName: "tag-selector-popover",
        modifiers: {
          preventOverflow: { enabled: true },
          flip: { enabled: true }
        }
      }}
      resetOnQuery={true}
      resetOnSelect={true}
    >
      <Blueprint.Button
        text={selectedTag}
        rightIcon="caret-down"
        minimal
        data-testid="tag-selector-cta"
      />
    </BlueprintSelect.Select>
  );
};

const TagSelectorItemWrapper = styled.div<{ active: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: 4px 6px;
  background-color: ${({ active }) => (active ? 'rgba(0, 0, 0, 0.05)' : 'transparent')};
  user-select: none;

  &:hover {
    cursor: pointer;
    background-color: ${({ active }) => (active ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.03)')};
  }
`;

const Tag = styled(Blueprint.Tag)`
  &.bp3-tag {
    font-size: 11px;
    padding: 1px 3px;
    min-height: auto;
    min-width: auto;
  }
`;

const TagSelectorItem = ({ text, originalText, onClick, active, tagsList }) => {
  const { today, setRenderMode } = React.useContext(MainContext);
  // 使用 originalText 来查找数据，text 用于显示
  const tagKey = originalText || text;
  const dueCount = today.tags[tagKey]?.due || 0;
  const newCount = today.tags[tagKey]?.new || 0;
  const tagRenderMode = today.tags[tagKey]?.renderMode || RenderMode.Normal;
  const [showTagSettings, setShowTagSettings] = React.useState(false);

  const index = tagsList.indexOf(tagKey);
  const placement = index === tagsList.length - 1 ? 'bottom' : 'top';

  const toggleTagSettings = () => {
    setShowTagSettings(!showTagSettings);
  };

  const toggleRenderMode = () => {
    const newRenderMode =
      tagRenderMode === RenderMode.Normal ? RenderMode.AnswerFirst : RenderMode.Normal;

    setRenderMode(tagKey, newRenderMode);
  };

  const tagSettingsMenu = (
    <div onClick={(e) => e.stopPropagation()}>
      <Blueprint.Menu className="bg-transparent min-w-full text-sm">
        <Blueprint.MenuItem
          text={
            <div className="flex items-center justify-between">
              <span className="text-xs">Swap Q/A</span>
              <Blueprint.Switch
                alignIndicator={Blueprint.Alignment.RIGHT}
                checked={tagRenderMode === RenderMode.AnswerFirst}
                onChange={toggleRenderMode}
                className="mb-0"
              />
            </div>
          }
          className="hover:bg-transparent hover:no-underline"
        />
        <Blueprint.MenuDivider />
      </Blueprint.Menu>
    </div>
  );

  return (
    <TagSelectorItemWrapper
      onClick={onClick}
      active={active}
      key={text}
      tabIndex={-1}
      data-testid="tag-selector-item"
      className="flex-col"
    >
      <div className="flex">
        <div className="flex items-center">{text}</div>
        <div className="ml-2">
          {dueCount > 0 && (
            <Tooltip content="Due" placement={placement}>
              <Tag
                active
                minimal
                intent="primary"
                className="text-center"
                data-testid="tag-selector-due"
              >
                {dueCount}
              </Tag>
            </Tooltip>
          )}
          {newCount > 0 && (
            <Tooltip content="New" placement={placement}>
              <Tag
                active
                minimal
                intent="success"
                className="text-center ml-2"
                data-testid="tag-selector-new"
              >
                {newCount}
              </Tag>
            </Tooltip>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="">
          <Blueprint.Button
            icon={<Blueprint.Icon icon={showTagSettings ? 'chevron-up' : 'cog'} size={11} />}
            className="ml-1 bp3-small"
            data-testid="tag-settings-button"
            minimal
            onClick={toggleTagSettings}
          />
        </div>
      </div>
      <Blueprint.Collapse isOpen={showTagSettings}>{tagSettingsMenu}</Blueprint.Collapse>
    </TagSelectorItemWrapper>
  );
};

const StatusBadge = ({ status, nextDueDate, isCramming }) => {
  if (isCramming) {
    return (
      <Tooltip content="Reviews don't affect scheduling" placement="left">
        <Blueprint.Tag intent="none">Cramming</Blueprint.Tag>
      </Tooltip>
    );
  }
  switch (status) {
    case 'new':
      return (
        <Blueprint.Tag intent="success" minimal>
          New
        </Blueprint.Tag>
      );

    case 'dueToday':
      return (
        <Blueprint.Tag intent="primary" minimal>
          Due Today
        </Blueprint.Tag>
      );

    case 'pastDue': {
      const timeAgo = dateUtils.customFromNow(nextDueDate);
      return (
        <Blueprint.Tag intent="warning" title={`Due ${timeAgo}`} minimal>
          Past Due
        </Blueprint.Tag>
      );
    }
    default:
      return null;
  }
};

const BoxIcon = styled(Blueprint.Icon)`
  margin-right: 5px !important;
`;

const BreadcrumbTooltipContent = ({ showBreadcrumbs }) => {
  return (
    <div className="flex align-center">
      {`${showBreadcrumbs ? 'Hide' : 'Show'} Breadcrumbs`}
      <span>
        <ButtonTags kind="light" className="mx-2">
          B
        </ButtonTags>
      </span>
    </div>
  );
};

const Header = ({
  tagsList,
  onCloseCallback,
  onTagChange,
  className,
  status,
  isDone,
  nextDueDate,
  showBreadcrumbs,
  setShowBreadcrumbs,
  isCramming,
  practiceCardUids,
  onOpenDeckPriority,
  isGlobalMixedMode,
  setIsGlobalMixedMode,
}: {
  tagsList: string[];
  onCloseCallback: () => void;
  onTagChange: (tag: string) => void;
  className?: string;
  status: any;
  isDone: boolean;
  nextDueDate: any;
  showBreadcrumbs: boolean;
  setShowBreadcrumbs: (show: boolean) => void;
  isCramming: boolean;
  practiceCardUids: string[];
  onOpenDeckPriority?: () => void;
  isGlobalMixedMode: boolean;
  setIsGlobalMixedMode: (mode: boolean) => void;
}) => {
  const { selectedTag, today, currentIndex } = useSafeContext(MainContext);
  
  // 🔧 防御性编程：确保 todaySelectedTag 存在
  const todaySelectedTag = today.tags[selectedTag] || {
    completed: 0,
    due: 0,
    new: 0,
    dueUids: [],
    newUids: [],
  };
  const completedTodayCount = todaySelectedTag.completed;
  
  // 🚀 REFACTOR: 不再使用本地计算的globalStats，改用来自后端的 today.combinedToday
  const globalStats = isGlobalMixedMode ? today.combinedToday : null;

  // 计算显示进度
  const queueLength = practiceCardUids.length;

  return (
    <HeaderWrapper className={className} tabIndex={0}>
      <div className="flex items-center">
        <BoxIcon icon="box" size={14} />
        <div tabIndex={-1}>
          <TagSelector tagsList={tagsList} selectedTag={selectedTag} onTagChange={onTagChange} />
        </div>

        {/* 🚀 新增：全局混合学习开关 */}
        <div className="mx-3">
          <GlobalMixedToggleWrapper
            className="flex items-center justify-center gap-1 bg-gray-50 px-2 py-1 rounded-md border border-gray-200"
            style={{ minWidth: '80px' }}
          >
            <span
              className={`text-xs ${!isGlobalMixedMode ? 'text-blue-600 font-medium' : 'text-gray-400'
                }`}
            >
              单组
            </span>
            <Blueprint.Switch
              className="mb-0"
              style={{ transform: 'scale(0.8)' }}
              checked={isGlobalMixedMode}
              onChange={() => setIsGlobalMixedMode(!isGlobalMixedMode)}
              data-testid="global-mixed-mode-switch"
            />
            <span
              className={`text-xs ${isGlobalMixedMode ? 'text-blue-600 font-medium' : 'text-gray-400'
                }`}
            >
              混合
            </span>
          </GlobalMixedToggleWrapper>
        </div>
      </div>
      
      <RightButtonGroup>
        {/* 牌组优先级管理按钮 */}
        {onOpenDeckPriority && (
          <Tooltip content="管理牌组优先级" placement="left">
            <Blueprint.Button
              icon="sort"
              minimal
              small
              onClick={onOpenDeckPriority}
            />
          </Tooltip>
        )}
        
        {/* Hide Breadcrumbs 按钮 */}
        {!isDone && (
          <div onClick={() => setShowBreadcrumbs(!showBreadcrumbs)} className="cursor-pointer">
            {/* @ts-ignore */}
            <Tooltip
              content={<BreadcrumbTooltipContent showBreadcrumbs={showBreadcrumbs} />}
              placement="left"
            >
              <Blueprint.Icon
                icon={showBreadcrumbs ? 'eye-open' : 'eye-off'}
                className={showBreadcrumbs ? 'opacity-100' : 'opacity-60'}
              />
            </Tooltip>
          </div>
        )}
        
        {/* 状态标记 */}
        <span data-testid="status-badge">
          <StatusBadge
            status={status}
            nextDueDate={nextDueDate}
            isCramming={isCramming}
            data-testid="status-badge"
          />
        </span>
        
        {/* 进度计数：新卡 / 旧卡 / 已完成 */}
        <CounterDisplay>
          {/* New Cards */}
          <span style={{ color: '#28a745' }} data-testid="count-new">
            {isGlobalMixedMode ? today.combinedToday.new : todaySelectedTag.new}
          </span>
          <span className="opacity-50">/</span>
          {/* Due Cards */}
          <span style={{ color: '#007bff' }} data-testid="count-due">
            {isGlobalMixedMode ? today.combinedToday.due : todaySelectedTag.due}
          </span>
          <span className="opacity-50">/</span>
          {/* Completed */}
          <span style={{ color: '#000' }} data-testid="count-completed">
            {isGlobalMixedMode ? today.combinedToday.completed : completedTodayCount}
          </span>
        </CounterDisplay>
        
        {/* 关闭按钮 */}
        <button
          aria-label="Close"
          className="bp3-dialog-close-button bp3-button bp3-minimal bp3-icon-cross"
          onClick={onCloseCallback}
        ></button>
      </RightButtonGroup>
    </HeaderWrapper>
  );
};

// 🚀 新增：全局混合开关的样式组件
const GlobalMixedToggleWrapper = styled.div`
  &:hover {
    background-color: #e8f4f8;
    border-color: #cce7f0;
  }

  transition: all 0.2s ease;
`;

// 右侧按钮组
const RightButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
`;

// 计数显示
const CounterDisplay = styled.span`
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
`;


export default PracticeOverlay;
