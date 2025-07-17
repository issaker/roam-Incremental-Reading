import * as React from 'react';
import { useAsyncExecution } from './useAsyncExecution';
import { useRoamData } from './useRoamData';
import { getAllPagesQuery, normalizeQueryResults } from '~/utils/roamApi';

interface UseAllPagesReturn {
  allPages: string[];
  isLoading: boolean;
  refreshPages: () => void;
}

const useAllPages = ({ 
  dataPageTitle 
}: { 
  dataPageTitle: string;
}) => {
  const { queryWithCache } = useRoamData({ defaultTtl: 10000 }); // 10秒缓存
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const { data: allPagesData, isLoading, execute } = useAsyncExecution(
    async () => {
      const results = await queryWithCache(
        `all-pages-${refreshNonce}`,
        getAllPagesQuery,
        10000
      );
      
      const pageTitles = normalizeQueryResults.toPageTitles(results);
      const dailyNoteRegex = /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}(st|nd|rd|th), \d{4}|^\d{4}-\d{2}-\d{2}$/;
      
      const filteredPages = pageTitles.filter(title => 
        !dailyNoteRegex.test(title) && title !== dataPageTitle
      );

      return [...new Set(filteredPages)];
    },
    [dataPageTitle, refreshNonce],
    {
      onError: (error) => console.error("获取页面列表失败:", error)
    }
  );

  const refreshPages = React.useCallback(() => {
    setRefreshNonce(prev => prev + 1);
  }, []);

  // 确保返回的allPages始终是数组，避免null问题
  const allPages = allPagesData || [];

  return {
    allPages,
    isLoading,
    refreshPages,
  };
};

export default useAllPages; 