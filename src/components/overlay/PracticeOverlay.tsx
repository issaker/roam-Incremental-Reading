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
  rtlEnabled: boolean;
  setRenderMode: (tag: string, mode: RenderMode) => void;
  dataPageTitle: string;
  onDataRefresh: () => void;
  allCardsCount: number;
  priorityOrder: string[];
  allCardUids: string[];
  defaultPriority: number;
  fsrsEnabled: boolean;
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
  rtlEnabled,
  setRenderMode,
  dataPageTitle,
  onDataRefresh,
  allCardsCount,
  priorityOrder,
  allCardUids,
  defaultPriority,
  fsrsEnabled,
}: Props) => {
  const todaySelectedTag = today.tags[selectedTag];
  const newCardsUids = todaySelectedTag.newUids;
  const dueCardsUids = todaySelectedTag.dueUids;
  
  // 按优先级排名合并队列
  const practiceCardUids = React.useMemo(() => {
    const allCards = [...dueCardsUids, ...newCardsUids];
    
    if (priorityOrder.length === 0) {
      return allCards;
    }
    
    return allCards.sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a as string);
      const bIndex = priorityOrder.indexOf(b as string);
      
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      
      return 0;
    });
  }, [dueCardsUids, newCardsUids, priorityOrder]);
  const renderMode = todaySelectedTag.renderMode;

  const [currentIndex, setCurrentIndex] = React.useState(0);

  const isFirst = currentIndex === 0;
  const completedTodayCount = todaySelectedTag.completed;

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
  useZIndexFix(isOpen);

  // 焦点管理：当弹窗打开时激活焦点保护，关闭时停用
  // 解决memo窗口中编辑时换行切换block导致的焦点丢失问题
  useFocusFix(isOpen);

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
          console.warn('🎯 优先级保存跳过: allCardUids为空');
          setRankingChanges({});
          setHasUnsavedChanges(false);
          return;
        }

        bulkSaveRankingChanges({ 
          rankingChanges, 
          dataPageTitle: validDataPageTitle,
          allCardUids
        }).then(() => {
          // ✅ 检查组件是否已卸载
          if (!isMountedRef.current) {
            console.log('🎯 组件已卸载，跳过状态更新');
            return;
          }
          
          console.log('🎯 优先级保存成功');
          setRankingChanges({}); // 成功后再清除
          setHasUnsavedChanges(false);
        }).catch(error => {
          // ✅ 检查组件是否已卸载
          if (!isMountedRef.current) {
            console.log('🎯 组件已卸载，跳过错误处理');
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
          
          // ✅ 不清除rankingChanges，保留用户修改供下次重试
          // setRankingChanges({});  // 注释掉，保留数据
        });
      }
    }
    
    prevShouldShowSlider.current = shouldShowSlider;
  }, [shouldShowSlider, rankingChanges, dataPageTitle, allCardUids]); // ✅ 添加allCardUids到依赖

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
        />

        <DialogBody
          className="bp3-dialog-body overflow-y-scroll m-0 pt-6 pb-8 px-4"
          dir={rtlEnabled ? 'rtl' : undefined}
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
`;

const TagSelector = ({ tagsList, selectedTag, onTagChange }) => {
  return (
    // @ts-ignore
    <BlueprintSelect.Select
      items={tagsList}
      activeItem={selectedTag}
      filterable={false}
      itemRenderer={(tag, { handleClick, modifiers }) => {
        return (
          <TagSelectorItem
            text={tag}
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
      popoverProps={{ minimal: true }}
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

const TagSelectorItem = ({ text, onClick, active, tagsList }) => {
  const { today, setRenderMode } = React.useContext(MainContext);
  const dueCount = today.tags[text].due;
  const newCount = today.tags[text].new;
  const tagRenderMode = today.tags[text].renderMode || RenderMode.Normal;
  const [showTagSettings, setShowTagSettings] = React.useState(false);

  const index = tagsList.indexOf(text);
  const placement = index === tagsList.length - 1 ? 'bottom' : 'top';

  const toggleTagSettings = () => {
    setShowTagSettings(!showTagSettings);
  };

  const toggleRenderMode = () => {
    const newRenderMode =
      tagRenderMode === RenderMode.Normal ? RenderMode.AnswerFirst : RenderMode.Normal;

    setRenderMode(text, newRenderMode);
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
}) => {
  const { selectedTag, today, currentIndex } = useSafeContext(MainContext);
  const todaySelectedTag = today.tags[selectedTag];
  const completedTodayCount = todaySelectedTag.completed;
  
  // 计算显示进度
  const queueLength = practiceCardUids ? practiceCardUids.length : 0;
  const todayTotalTarget = isCramming ? queueLength : completedTodayCount + queueLength;
  const currentDisplayCount = isCramming ? currentIndex + 1 : completedTodayCount + currentIndex + 1;

  return (
    <HeaderWrapper className={className} tabIndex={0}>
      <div className="flex items-center">
        <BoxIcon icon="box" size={14} />
        <div tabIndex={-1}>
          <TagSelector tagsList={tagsList} selectedTag={selectedTag} onTagChange={onTagChange} />
        </div>
      </div>
      <div className="flex items-center justify-end">
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

export default PracticeOverlay;
