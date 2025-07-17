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
  isGlobalMixedMode,
  dailyLimit,
  defaultPriority,
}) => {
  // 🚀 P1: 使用 useRef 存储大对象，避免不必要的重渲染
  const practiceDataRef = React.useRef<CompleteRecords>({});
  const priorityOrderRef = React.useRef<string[]>([]);
  const priorityManagerRef = React.useRef<any>(null);
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
        // 🚀 使用事件通知系统告知 UI 数据加载进度
        window.dispatchEvent(new CustomEvent('memoLoadingProgress', { 
          detail: { status: '正在加载卡片信息...', progress: 10 } 
        }));
        
        // 🚀 首先快速加载基础统计数据
        const quickStats = await queries.getQuickStats({
          tagsList,
          dataPageTitle,
          dailyLimit,
          isGlobalMixedMode,
        });
        
        // 立即更新基础数据以快速渲染
        setToday(quickStats.todayStats);
        setAllCardsCount(quickStats.allCardsCount);
        setDataVersion(prev => prev + 1);
        
        window.dispatchEvent(new CustomEvent('memoLoadingProgress', { 
          detail: { status: '正在加载练习数据...', progress: 40 } 
        }));
        
        // 🚀 然后异步加载完整数据
        const fullData = await queries.getPracticeData({
          tagsList,
          dataPageTitle,
          dailyLimit,
          isCramming,
          cachedData,
          defaultPriority: stableDefaultPriority,
          isGlobalMixedMode,
        });

        window.dispatchEvent(new CustomEvent('memoLoadingProgress', { 
          detail: { status: '正在处理优先级...', progress: 80 } 
        }));

        // 🚀 P1: 更新 Ref 存储的大对象
        practiceDataRef.current = fullData.practiceData;
        priorityOrderRef.current = fullData.priorityOrder;
        priorityManagerRef.current = fullData.priorityManager;
        allCardUidsRef.current = fullData.allCardUids;
        cardUidsRef.current = fullData.cardUids;

        // 🚀 P1: 更新完整数据
        setToday(fullData.todayStats);
        setAllCardsCount(fullData.allCardsCount);
        setDataVersion(prev => prev + 1); // 触发组件重渲染
        
        window.dispatchEvent(new CustomEvent('memoLoadingProgress', { 
          detail: { status: '准备完成', progress: 100 } 
        }));
      } catch (error) {
        console.error('📊 [usePracticeData] 数据获取失败:', error);
        window.dispatchEvent(new CustomEvent('memoLoadingProgress', { 
          detail: { status: '加载失败', progress: 0 } 
        }));
      } finally {
        isExecutingRef.current = false;
      }
    })();
  }, [
    selectedTag,
    dataPageTitle,
    refetchTrigger,
    isCramming,
    isGlobalMixedMode,
    dailyLimit,
    tagsList,
    cachedData,
    stableDefaultPriority,
  ]);

  return {
    // 🚀 P1: 返回 getter 函数而非直接的大对象
    get practiceData() { return practiceDataRef.current; },
    get priorityOrder() { return priorityOrderRef.current; },
    get priorityManager() { return priorityManagerRef.current; },
    get allCardUids() { return allCardUidsRef.current; },
    get cardUids() { return cardUidsRef.current; },
    fetchPracticeData: refetchTriggerFn,
    today,
    allCardsCount,
    dataVersion, // 用于组件决定是否重渲染
  };
};

export default usePracticeCardsData;
