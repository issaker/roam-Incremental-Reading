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
  const practiceDataRef = React.useRef<CompleteRecords>({});
  const [refetchTrigger, setRefetchTrigger] = React.useState(false);
  const [today, setToday] = React.useState<Today>(TodayInitial);
  const [allCardsCount, setAllCardsCount] = React.useState<number>(0);
  const [priorityOrder, setPriorityOrder] = React.useState<string[]>([]);
  const [allCardUids, setAllCardUids] = React.useState<string[]>([]);
  const [cardUids, setCardUids] = React.useState<Record<string, string[]>>({});

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

        setToday(todayStats);
        practiceDataRef.current = practiceData;
        setAllCardsCount(allCardsCount);
        setPriorityOrder(priorityOrder);
        setAllCardUids(allCardUids);
        setCardUids(cardUids);
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
    practiceData: practiceDataRef.current,
    fetchPracticeData: refetchTriggerFn,
    today,
    allCardsCount,
    priorityOrder,
    allCardUids,
    cardUids,
  };
};

export default usePracticeCardsData;
