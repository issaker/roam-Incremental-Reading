import * as React from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface UseRoamDataOptions {
  defaultTtl?: number;
  maxCacheSize?: number;
}

/**
 * 统一的 Roam 数据查询Hook，提供缓存机制
 */
export const useRoamData = (options: UseRoamDataOptions = {}) => {
  const {
    defaultTtl = 5000, // 5秒默认缓存时间
    maxCacheSize = 100
  } = options;

  const cacheRef = React.useRef<Map<string, CacheEntry<any>>>(new Map());

  const queryWithCache = React.useCallback(async <T>(
    key: string,
    queryFn: () => Promise<T>,
    ttl: number = defaultTtl
  ): Promise<T> => {
    const cache = cacheRef.current;
    const cached = cache.get(key);
    
    // 检查缓存是否有效
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
    
    // 执行查询
    const data = await queryFn();
    
    // 缓存大小控制
    if (cache.size >= maxCacheSize) {
      // 清理最老的缓存条目
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    
    // 更新缓存
    cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }, [defaultTtl, maxCacheSize]);

  const clearCache = React.useCallback((key?: string) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  const getCacheStats = React.useCallback(() => {
    const cache = cacheRef.current;
    return {
      size: cache.size,
      keys: Array.from(cache.keys()),
      entries: Array.from(cache.entries()).map(([key, entry]) => ({
        key,
        timestamp: entry.timestamp,
        age: Date.now() - entry.timestamp
      }))
    };
  }, []);

  return {
    queryWithCache,
    clearCache,
    getCacheStats
  };
};