import * as React from 'react';
import { BlockInfo, fetchBlockInfo } from '~/queries';

// 创建一个全局缓存来存储块信息，避免重复查询
const blockInfoCache = new Map<string, BlockInfo>();

// 🎯 NEW: 清除特定block的缓存
export const clearBlockInfoCache = (refUid: string) => {
  blockInfoCache.delete(refUid);
};

// 🎯 NEW: 清除所有缓存
export const clearAllBlockInfoCache = () => {
  blockInfoCache.clear();
};

const useBlockInfo = ({ refUid }) => {
  const [blockInfo, setBlockInfo] = React.useState<BlockInfo>({} as BlockInfo);
  const [isLoading, setIsLoading] = React.useState(false);
  const [forceRefresh, setForceRefresh] = React.useState(0);

  // 🎯 NEW: 强制刷新函数
  const refreshBlockInfo = React.useCallback(() => {
    if (refUid) {
      clearBlockInfoCache(refUid);
      setForceRefresh(prev => prev + 1);
    }
  }, [refUid]);

  React.useEffect(() => {
    if (!refUid) return;

    const fetch = async () => {
      setIsLoading(true);
      try {
        // 🎯 FIXED: 每次都重新获取最新的block信息，不依赖缓存
        // 这样可以确保当子块被删除后，能够获取到最新状态
        console.log('🔍 [BlockInfo] 获取最新block信息 for:', refUid);
        const freshBlockInfo = await fetchBlockInfo(refUid);
        
        console.log('🔍 [BlockInfo] 获取结果:', {
          refUid,
          hasChildren: !!freshBlockInfo.children?.length,
          hasChildrenUids: !!freshBlockInfo.childrenUids?.length,
          childrenCount: freshBlockInfo.children?.length || 0
        });
        
        // 更新缓存
        blockInfoCache.set(refUid, freshBlockInfo);
        
        setBlockInfo({ ...freshBlockInfo, refUid });
      } catch (error) {
        console.error('🔍 [BlockInfo] 获取block信息失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetch();
  }, [refUid, forceRefresh]); // 🎯 NEW: 添加forceRefresh依赖

  return {
    blockInfo,
    isLoading,
    refreshBlockInfo, // 🎯 NEW: 返回刷新函数
  };
};

export default useBlockInfo;
