import * as React from 'react';

// 查询所有页面的 Datalog 查询
const getAllPagesQuery = `[
  :find ?title ?uid
  :where
    [?page :node/title ?title]
    [?page :block/uid ?uid]
]`;

// 判断是否为 Daily Note
const isDailyNote = (title: string): boolean => {
  // Daily Notes 通常符合特定的日期格式
  const datePatterns = [
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th)?,\s+\d{4}$/,
    /^\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/,
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}-\d{2}-\d{4}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
  ];
  
  return datePatterns.some(pattern => pattern.test(title));
};

interface UseAllPagesReturn {
  allPages: string[];
  undefinedDeckCards: string[]; // 只属于 Daily Notes 的卡片
  isLoading: boolean;
  refreshPages: () => void;
}

const useAllPages = ({ 
  tagsList, 
  dataPageTitle 
}: { 
  tagsList: string[]; 
  dataPageTitle: string;
}): UseAllPagesReturn => {
  const [allPages, setAllPages] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState(0);

  const fetchAllPages = React.useCallback(async () => {
    try {
      setIsLoading(true);
      
      // 获取所有页面
      const results = await window.roamAlphaAPI.q(getAllPagesQuery);
      
      // 过滤掉 Daily Notes 和数据页面
      const filteredPages = results
        .map(([title, uid]) => title)
        .filter(title => 
          !isDailyNote(title) && 
          title !== dataPageTitle &&
          title.trim() !== ''
        )
        .sort((a, b) => a.localeCompare(b, 'zh-CN')); // 支持中文排序
      
      // 合并现有的 tagsList 和自动发现的页面，去重
      const mergedPages = Array.from(new Set([...tagsList, ...filteredPages]));
      
      setAllPages(mergedPages);
    } catch (error) {
      console.error('获取页面列表失败:', error);
      // 失败时至少保留现有的 tagsList
      setAllPages(tagsList);
    } finally {
      setIsLoading(false);
    }
  }, [tagsList, dataPageTitle]);

  // 初始加载
  React.useEffect(() => {
    fetchAllPages();
  }, [fetchAllPages]);

  // 定期刷新（每5分钟）
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchAllPages();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchAllPages]);

  const refreshPages = React.useCallback(() => {
    setLastRefresh(Date.now());
    fetchAllPages();
  }, [fetchAllPages]);

  // TODO: 实现获取只属于 Daily Notes 的卡片
  const undefinedDeckCards: string[] = [];

  return {
    allPages,
    undefinedDeckCards,
    isLoading,
    refreshPages,
  };
};

export default useAllPages; 