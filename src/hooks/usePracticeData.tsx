import * as React from 'react';
import { Today, TodayInitial } from '~/models/practice';
import { CompleteRecords } from '~/models/session';
import * as queries from '~/queries';

const usePracticeCardsData = ({
  tagsList,
  selectedTag,
  dataPageTitle,
  cachedData,
  isCramming,
  dailyLimit,
  shuffleCards,
  defaultPriority,
}) => {
  const [practiceData, setPracticeData] = React.useState<CompleteRecords>({});
  const [refetchTrigger, setRefetchTrigger] = React.useState(false);
  const [today, setToday] = React.useState<Today>(TodayInitial);
  const [allCardsCount, setAllCardsCount] = React.useState<number>(0);
  const [priorityOrder, setPriorityOrder] = React.useState<string[]>([]);
  const [allCardUids, setAllCardUids] = React.useState<string[]>([]);

  const refetchTriggerFn = () => setRefetchTrigger((trigger) => !trigger);

  const stableDefaultPriority = React.useMemo(() => {
    return typeof defaultPriority === 'number' ? defaultPriority : 70;
  }, [defaultPriority]);

  const isExecutingRef = React.useRef(false);

  React.useEffect(() => {
    if (isExecutingRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 [usePracticeData] 跳过重复执行，因为正在处理中...');
      }
      return;
    }

    (async () => {
      if (!selectedTag) return;

      isExecutingRef.current = true;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 [usePracticeData] useEffect触发，参数:', {
          selectedTag,
          dataPageTitle,
          defaultPriority: stableDefaultPriority,
          refetchTrigger,
          '调用时间': new Date().toISOString()
        });
        
        console.log('📊 [usePracticeData] 开始获取数据...');
      }
      
      try {
        const { practiceData, todayStats, allCardsCount, priorityOrder, allCardUids } = await queries.getPracticeData({
          tagsList,
          dataPageTitle,
          dailyLimit,
          isCramming,
          shuffleCards,
          cachedData,
          defaultPriority: stableDefaultPriority,
        });

        if (process.env.NODE_ENV === 'development') {
          console.log('📊 [usePracticeData] 数据获取完成，allCardsCount:', allCardsCount);
          console.log('🎯 [usePracticeData] priorityOrder:', priorityOrder);
        }

        setToday(todayStats);
        setPracticeData(practiceData);
        setAllCardsCount(allCardsCount);
        setPriorityOrder(priorityOrder);
        setAllCardUids(allCardUids);
      } catch (error) {
        console.error('📊 [usePracticeData] 数据获取失败:', error);
      } finally {
        isExecutingRef.current = false;
      }
    })();
  }, [
    selectedTag,
    dataPageTitle,
    refetchTrigger,
    isCramming,
    dailyLimit,
    tagsList,
    shuffleCards,
    cachedData,
    stableDefaultPriority,
  ]);

  return {
    practiceData,
    fetchPracticeData: refetchTriggerFn,
    today,
    allCardsCount,
    priorityOrder,
    allCardUids,
  };
};

export default usePracticeCardsData;
