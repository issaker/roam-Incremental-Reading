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
import PrioritySlider from '~/components/overlay/PrioritySlider';
import ButtonTags from '~/components/ButtonTags';
import DeckPriorityManager from '~/components/DeckPriorityManager';
import useDeckPriority from '~/hooks/useDeckPriority';
import { CompleteRecords, IntervalMultiplierType, ReviewModes } from '~/models/session';
import useCurrentCardData from '~/hooks/useCurrentCardData';
import { generateNewSession } from '~/queries';
import { CompletionStatus, Today, RenderMode } from '~/models/practice';
import { handlePracticeProps } from '~/app';
import { useSafeContext } from '~/hooks/useSafeContext';
import { bulkSaveRankingChanges, getCardRank } from '~/queries/save';

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
  deckPriorities: Record<string, any>;
  isGlobalMixedMode: boolean;
  setIsGlobalMixedMode: (mode: boolean) => void;
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
  deckPriorities,
  isGlobalMixedMode,
  setIsGlobalMixedMode,
}: Props) => {
  const todaySelectedTag = today.tags[selectedTag] || { completed: 0, dueUids: [], newUids: [] };
  const completedTodayCount = todaySelectedTag.completed;
  
  // 🚀 修改：根据混合学习模式生成不同的练习队列
  const practiceCardUids = React.useMemo(() => {
    let cardUidsToPractice: string[] = [];

    if (isGlobalMixedMode) {
      // 全局混合模式：从所有牌组收集卡片
      cardUidsToPractice = tagsList.flatMap(tag => {
        const tagData = today.tags[tag];
        return tagData ? [...tagData.dueUids, ...tagData.newUids] : [];
      });
      // 去重
      cardUidsToPractice = [...new Set(cardUidsToPractice)];
    } else {
      // 单牌组模式：仅显示当前选中牌组的卡片
      cardUidsToPractice = [...todaySelectedTag.dueUids, ...todaySelectedTag.newUids];
    }
    
    // 按全局优先级排序
    if (priorityOrder.length > 0) {
      const rankMap = new Map(priorityOrder.map((uid, i) => [uid, i]));
      const getRank = (uid: string) => rankMap.get(uid) ?? Number.MAX_SAFE_INTEGER;
      return cardUidsToPractice.sort((a, b) => getRank(a) - getRank(b));
    }
    
    return cardUidsToPractice;
  }, [isGlobalMixedMode, tagsList, today.tags, todaySelectedTag.dueUids, todaySelectedTag.newUids, priorityOrder]);

  const renderMode = todaySelectedTag.renderMode;

  const [currentIndex, setCurrentIndex] = React.useState(0);

  const isFirst = currentIndex === 0;

  const currentCardRefUid = practiceCardUids[currentIndex] as string | undefined;

  const sessions = React.useMemo(() => {
    return currentCardRefUid ? practiceData[currentCardRefUid] || [] : [];
  }, [currentCardRefUid, practiceData]);
  const { currentCardData, reviewMode, setReviewModeOverride } = useCurrentCardData({
    currentCardRefUid,
    sessions,
  });

  const totalCardsCount = todaySelectedTag.new + todaySelectedTag.due;
  const hasCards = totalCardsCount > 0;
  
  const isDone = todaySelectedTag.status === CompletionStatus.Finished || !currentCardData;

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

  // 协同排名系统状态管理
  const [rankingChanges, setRankingChanges] = React.useState<Record<string, number>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  
  // 牌组优先级管理
  const [showDeckPriorityManager, setShowDeckPriorityManager] = React.useState(false);
  
  // 🚀 新增：牌组偏移处理函数（绝对优先级偏移）
  const handleDeckOffsetApply = React.useCallback(async (deckName: string, offsetValue: number) => {
    try {
      // 0. 零偏移快速返回
      if (offsetValue === 0) {
        console.log(`牌组 ${deckName} 偏移量为0，跳过操作`);
        return;
      }

      // 1. 获取该牌组的所有卡片UID
      const deckCardUids = cardUids[deckName] || [];
      if (deckCardUids.length === 0) {
        console.warn(`牌组 ${deckName} 没有卡片，跳过偏移操作`);
        return;
      }

      // 2. 创建rankMap以便快速查找当前排名
      const rankMap = new Map(priorityOrder.map((uid, i) => [uid, i + 1]));
      const N = allCardsCount;
      
      // 3. 处理单卡总量边界情况
      if (N <= 1) {
        console.log(`总卡片数量 ${N}，直接设置rank=1`);
        const rankingChanges: Record<string, number> = {};
        deckCardUids.forEach(uid => {
          rankingChanges[uid] = 1;
        });
        await bulkSaveRankingChanges({ rankingChanges, dataPageTitle, allCardUids });
        onDataRefresh();
        return;
      }
      
      // 4. 计算每张卡新的 priority → rank，并处理边界重叠
      const entries = deckCardUids.map(uid => {
        const currentRank = rankMap.get(uid) || Math.ceil(N * (1 - defaultPriority / 100));
        // 转换当前排名为优先级百分比：priority = (1 - (rank-1)/(N-1)) * 100
        const currentPriority = (1 - (currentRank - 1) / (N - 1)) * 100;
        
        // 应用绝对偏移并限制在 0-100 范围内
        const newPriority = Math.max(0, Math.min(100, currentPriority + offsetValue));
        
        // 转换新优先级为排名：rank = (1 - priority/100) * (N-1) + 1
        const rawRank = (1 - newPriority / 100) * (N - 1) + 1;
        return { uid, target: Math.round(rawRank) };
      });

      // 5. 解决边界重叠：rank 相同按 UID 升序排序，然后分配唯一排名
      entries.sort((a, b) => 
        a.target === b.target ? a.uid.localeCompare(b.uid) : a.target - b.target
      );

      const rankingChanges: Record<string, number> = {};
      let lastRank = 0;
      entries.forEach(({ uid, target }, index) => {
        // 确保排名唯一且在有效范围内，防止尾部溢出
        let uniqueRank = Math.max(target, lastRank + 1);
        if (uniqueRank > N) {
          // 若超出总数，从尾部向前分配剩余位置
          const remainingSlots = N - index;
          uniqueRank = Math.max(1, remainingSlots);
        }
        rankingChanges[uid] = uniqueRank;
        lastRank = uniqueRank;
      });

      // 6. 批量保存排名变更
      await bulkSaveRankingChanges({
        rankingChanges,
        dataPageTitle,
        allCardUids
      });

      // 7. 刷新数据以反映新的排名
      onDataRefresh();
      
      // 8. 用户反馈
      if (window.roamAlphaAPI?.ui?.showToast) {
        window.roamAlphaAPI.ui.showToast({
          message: `牌组「${deckName}」已偏移 ${offsetValue > 0 ? '+' : ''}${offsetValue} 点`,
          intent: 'success',
          timeout: 3000
        });
      }
    } catch (error) {
      console.error('牌组偏移应用失败:', error);
      if (window.roamAlphaAPI?.ui?.showToast) {
        window.roamAlphaAPI.ui.showToast({
          message: '牌组优先级偏移应用失败，请重试',
          intent: 'danger',
          timeout: 5000
        });
      }
    }
  }, [cardUids, priorityOrder, allCardsCount, defaultPriority, dataPageTitle, allCardUids, onDataRefresh]);
  
  // ✅ 添加组件卸载标志，防止异步操作在组件卸载后执行
  const isMountedRef = React.useRef(true);
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // 获取当前卡片的排名
  const currentCardRank = React.useMemo(() => {
    if (!currentCardRefUid) {
      return Math.max(1, Math.ceil(allCardsCount * (1 - defaultPriority / 100)));
    }
    
    // 检查是否有本地未保存的变更
    if (rankingChanges[currentCardRefUid] !== undefined) {
      return rankingChanges[currentCardRefUid];
    }
    
    const index = priorityOrder.indexOf(currentCardRefUid);
    return index === -1 ? 1 : index + 1;
  }, [currentCardRefUid, priorityOrder, allCardsCount, rankingChanges, defaultPriority]);

  // 处理排名变更 - 只更新本地状态，不立即保存
  const handleRankingChange = React.useCallback((newRank: number) => {
    if (!currentCardRefUid) return;
    
    setRankingChanges(prev => ({
      ...prev,
      [currentCardRefUid]: newRank
    }));
    
    setHasUnsavedChanges(true);
  }, [currentCardRefUid]);

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

  const { blockInfo, isLoading: blockInfoLoading, refreshBlockInfo } = useBlockInfo({ refUid: currentCardRefUid });
  const hasBlockChildren = !!blockInfo.children && !!blockInfo.children.length;
  const hasBlockChildrenUids = !!blockInfo.childrenUids && !!blockInfo.childrenUids.length;

  // 🚀 P1: 预取下一张卡片的 blockInfo，提升用户体验
  const nextCardRefUid = practiceCardUids[currentIndex + 1];
  const { blockInfo: nextBlockInfo } = useBlockInfo({ 
    refUid: nextCardRefUid,
    // 只在有下一张卡时才预取，避免不必要的请求
    skip: !nextCardRefUid 
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
  const previousQueueLength = React.useRef(practiceCardUids.length);
  
  React.useEffect(() => {
    // 只在队列长度变化时重置索引
    if (practiceCardUids.length !== previousQueueLength.current) {
      setCurrentIndex(0);
      previousQueueLength.current = practiceCardUids.length;
    }
  }, [practiceCardUids.length]);

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
  const contentRef = useZIndexFix<HTMLDivElement>();
  useFocusFix(contentRef);

  // 在滑块消失时批量保存优先级数据
  const shouldShowSlider = !isDone && hasCards;
  const prevShouldShowSlider = React.useRef(shouldShowSlider);
  
  React.useEffect(() => {
    // 检测滑块从显示变为隐藏（完成复习、窗口关闭等）
    if (prevShouldShowSlider.current && !shouldShowSlider) {
      if (Object.keys(rankingChanges).length > 0) {
        // ✅ 参数验证
        const validDataPageTitle = dataPageTitle?.trim() || 'roam/memo';
        if (!allCardUids || allCardUids.length === 0) {
          return;
        }

        bulkSaveRankingChanges({ 
          rankingChanges, 
          dataPageTitle: validDataPageTitle,
          allCardUids
        }).then(() => {
          // ✅ 检查组件是否已卸载
          if (!isMountedRef.current) {
            return;
          }
          
          setRankingChanges({}); // 成功后再清除
          setHasUnsavedChanges(false);
        }).catch(error => {
          // ✅ 检查组件是否已卸载
          if (!isMountedRef.current) {
            return;
          }
          
          console.error('🎯 优先级保存失败:', error);
          
          // ✅ 用户反馈
          if (window.roamAlphaAPI?.ui?.showToast) {
            window.roamAlphaAPI.ui.showToast({
              message: '优先级保存失败，数据暂存本地。请重新打开练习窗口重试。',
              intent: 'warning',
              timeout: 5000
            });
          }
        });
      }
    }
    
    prevShouldShowSlider.current = shouldShowSlider;
  }, [shouldShowSlider, rankingChanges, dataPageTitle, allCardUids]); // ✅ 添加allCardUids到依赖

  // 🚀 CLEANUP: 移除本地计算的 globalStats，改用来自 usePracticeData 的 today.combinedToday，它是经过后端去重处理的唯一数据源
  const queueLength = practiceCardUids ? practiceCardUids.length : 0;
  const todayTotalTarget = isCramming 
    ? queueLength 
    : isGlobalMixedMode
    ? today.combinedToday.completed + queueLength
    : completedTodayCount + queueLength;
  const currentDisplayCount = isCramming 
    ? currentIndex + 1 
    : isGlobalMixedMode
    ? today.combinedToday.completed + currentIndex + 1
    : completedTodayCount + currentIndex + 1;

  // 🚀 计算全局混合模式下的统计数据 - 此部分已被移除，因为逻辑已移至 today.ts
  /*
  const globalStats = React.useMemo(() => {
    if (!isGlobalMixedMode) return null;

    let totalDue = 0;
    let totalNew = 0;
    let totalCompleted = 0;

    for (const tag of tagsList) {
      const tagData = today.tags[tag];
      if (tagData) {
        totalDue += tagData.due || 0;
        totalNew += tagData.new || 0;
        totalCompleted += tagData.completed || 0;
      }
    }

    return { totalDue, totalNew, totalCompleted };
  }, [isGlobalMixedMode, tagsList, today.tags]);
  */

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
      {/* @ts-ignore */}
      <Dialog
        isOpen={isOpen}
        onClose={onCloseCallback}
        className="pb-0 bg-white"
        canEscapeKeyClose={false}
        ref={contentRef}
      >
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
          practiceCardUids={practiceCardUids}
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
        {/* Priority Slider - only show when we have cards and are not done */}
        {shouldShowSlider && (
          <PrioritySlider
            priority={currentCardRank}
            onPriorityChange={handleRankingChange}
            disabled={false}
            allCardsCount={allCardsCount}
          />
        )}
      </Dialog>
      
      {/* 牌组优先级管理器 */}
      <DeckPriorityManager
        isOpen={showDeckPriorityManager}
        onClose={() => setShowDeckPriorityManager(false)}
        deckPriorities={deckPriorities}
        selectedDeck={selectedTag}
        onApplyOffset={handleDeckOffsetApply}
      />
    </MainContext.Provider>
  );
};

const Dialog = styled(Blueprint.Dialog)`
  display: grid;
  grid-template-rows: 50px 1fr auto;
  max-height: 80vh;
  width: 90vw;

  ${mediaQueries.lg} {
    width: 80vw;
  }

  ${mediaQueries.xl} {
    width: 70vw;
  }

  /* 📱 Mobile portrait: full-screen vertical layout */
  ${mediaQueries.mobilePortrait} {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    margin: 0; /* remove offset around dialog */
    border-radius: 0;
    grid-template-rows: auto 1fr auto;
  }
`;

const DialogBody = styled.div`
  overflow-x: hidden; // because of tweaks we do in ContentWrapper container overflows
  min-height: 200px;
`;

const HeaderWrapper = styled.div`
  justify-content: space-between;
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
  const queueLength = practiceCardUids ? practiceCardUids.length : 0;
  const todayTotalTarget = isCramming
    ? queueLength
    : isGlobalMixedMode
    ? globalStats
      ? globalStats.completed + queueLength
      : 0
    : completedTodayCount + queueLength;
  const currentDisplayCount = isCramming
    ? currentIndex + 1
    : isGlobalMixedMode
    ? globalStats
      ? globalStats.completed + currentIndex + 1
      : 0
    : completedTodayCount + currentIndex + 1;

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
      
      <div className="flex items-center justify-end">
        {/* 🚀 REMOVED: 根据用户反馈，移除全局状态提示，简化UI */}

        {/* 牌组优先级管理按钮 */}
        {onOpenDeckPriority && (
          <Tooltip content="管理牌组优先级" placement="left">
            <Blueprint.Button
              icon="sort"
              minimal
              small
              onClick={onOpenDeckPriority}
              className="mx-1"
            />
          </Tooltip>
        )}
        {!isDone && (
          <div onClick={() => setShowBreadcrumbs(!showBreadcrumbs)} className="px-1 cursor-pointer">
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
        <span data-testid="status-badge">
          <StatusBadge
            status={status}
            nextDueDate={nextDueDate}
            isCramming={isCramming}
            data-testid="status-badge"
          />
        </span>
        <span className="text-sm mx-2 font-medium">
          <span data-testid="display-count-current">{isDone ? 0 : currentDisplayCount}</span>
          <span className="opacity-50 mx-1">/</span>
          <span className="opacity-50" data-testid="display-count-total">
            {isDone ? 0 : todayTotalTarget}
          </span>
        </span>
        <button
          aria-label="Close"
          className="bp3-dialog-close-button bp3-button bp3-minimal bp3-icon-cross"
          onClick={onCloseCallback}
        ></button>
      </div>
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

export default PracticeOverlay;
