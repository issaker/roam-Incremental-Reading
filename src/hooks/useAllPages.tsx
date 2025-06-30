import * as React from 'react';

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
  const [allPages, setAllPages] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const isExecutingRef = React.useRef(false);
  const [refreshNonce, setRefreshNonce] = React.useState(0);

  const refreshPages = () => {
    setRefreshNonce(prev => prev + 1);
  };
  
  React.useEffect(() => {
    const fetchPages = async () => {
      if (isExecutingRef.current) {
        return;
      }
      isExecutingRef.current = true;
      setIsLoading(true);

      try {
        const query = `[:find ?title :where [?p :node/title ?title] [?p :block/uid ?uid]]`;
        const results = window.roamAlphaAPI.q(query);
        const pageTitles = results.map(result => result[0]).filter(Boolean);

        const dailyNoteRegex = /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}(st|nd|rd|th), \d{4}|^\d{4}-\d{2}-\d{2}$/;
        const filteredPages = pageTitles.filter(title => 
          !dailyNoteRegex.test(title) && title !== dataPageTitle
        );

        const finalPages = [...new Set(filteredPages)];
        
        setAllPages(finalPages);
      } catch (e) {
        console.error("获取页面列表失败:", e);
        // 保留初始列表作为备用
        setAllPages([]);
      } finally {
        setIsLoading(false);
        isExecutingRef.current = false;
      }
    };

    fetchPages();
  }, [dataPageTitle, refreshNonce]);

  return {
    allPages,
    isLoading,
    refreshPages,
  };
};

export default useAllPages; 