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
  // 🚀 P1: 使用 useRef 存储大对象，避免不必要的重渲染
  const practiceDataRef = React.useRef<CompleteRecords>({});
  const priorityOrderRef = React.useRef<string[]>([]);
  const allCardUidsRef = React.useRef<string[]>([]);
  const cardUidsRef = React.useRef<Record<string, string[]>>({});
  
  // 🚀 P1: 只在 state 中保存版本号和关键状态，触发重渲染
  const [dataVersion, setDataVersion] = React.useState(0);
  const [refetchTrigger, setRefetchTrigger] = React.useState(false);
  const [today, setToday] = React.useState<Today>(TodayInitial);
  const [allCardsCount, setAllCardsCount] = React.useState<number>(0);

  const refetchTriggerFn = () => setRefetchTrigger((trigger) => !trigger);

  const stableDefaultPriority = React.useMemo(() => {
    return typeof defaultPriority === 'number' ? defaultPriority : 70;
  }, [defaultPriority]);

  const isExecutingRef = React.useRef(false);

  React.useEffect(() => {
    if (isExecutingRef.current) {
      return;
    }

    (async () => {
      if (!selectedTag) {
        return;
      }

      isExecutingRef.current = true;
      
      try {
        const { practiceData, todayStats, allCardsCount, priorityOrder, allCardUids, cardUids } = await queries.getPracticeData({
          tagsList,
          dataPageTitle,
          dailyLimit,
          isCramming,
          shuffleCards,
          cachedData,
          defaultPriority: stableDefaultPriority,
        });

        // 🚀 P1: 更新 Ref 存储的大对象
        practiceDataRef.current = practiceData;
        priorityOrderRef.current = priorityOrder;
        allCardUidsRef.current = allCardUids;
        cardUidsRef.current = cardUids;

        // 🚀 P1: 更新 state 中的关键数据和版本号
        setToday(todayStats);
        setAllCardsCount(allCardsCount);
        setDataVersion(prev => prev + 1); // 触发组件重渲染
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
    // 🚀 P1: 返回 getter 函数而非直接的大对象
    get practiceData() { return practiceDataRef.current; },
    get priorityOrder() { return priorityOrderRef.current; },
    get allCardUids() { return allCardUidsRef.current; },
    get cardUids() { return cardUidsRef.current; },
    fetchPracticeData: refetchTriggerFn,
    today,
    allCardsCount,
    dataVersion, // 用于组件决定是否重渲染
  };
};

export default usePracticeCardsData;
