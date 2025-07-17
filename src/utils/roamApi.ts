/**
 * 统一的 Roam API 抽象层
 * 提供标准化的查询接口和错误处理
 */

/**
 * 创建标准的 Roam 查询函数
 */
export const createRoamQuery = (query: string) => {
  return async (...params: any[]) => {
    try {
      return await window.roamAlphaAPI.q(query, ...params);
    } catch (error) {
      console.error('Roam API 查询失败:', { query, params, error });
      throw error;
    }
  };
};

/**
 * 常用的页面查询函数
 */
export const getAllPagesQuery = createRoamQuery(
  `[:find ?title :where [?p :node/title ?title] [?p :block/uid ?uid]]`
);

export const getPageByTitleQuery = createRoamQuery(
  `[:find ?uid :in $ ?title :where [?page :node/title ?title] [?page :block/uid ?uid]]`
);

export const getPageReferenceIds = createRoamQuery(
  `[:find ?uid :in $ ?title :where [?page :node/title ?title] [?referencingBlock :block/refs ?page] [?referencingBlock :block/uid ?uid]]`
);

export const getSelectedTagPageBlocksIds = createRoamQuery(
  `[:find ?uid :in $ ?title :where [?page :node/title ?title] [?child :block/page ?page] [?child :block/uid ?uid]]`
);

/**
 * 统一的错误处理包装器
 */
export const withErrorHandling = <T extends (...args: any[]) => any>(
  fn: T,
  context: string
): T => {
  return ((...args: any[]) => {
    try {
      return fn(...args);
    } catch (error) {
      console.error(`[${context}] 操作失败:`, error);
      throw error;
    }
  }) as T;
};

/**
 * 批量查询工具
 */
export const batchQuery = async <T>(
  queries: Array<() => Promise<T>>,
  batchSize = 5
): Promise<T[]> => {
  const results: T[] = [];
  
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(query => query()));
    results.push(...batchResults);
  }
  
  return results;
};

/**
 * 查询结果规范化器
 */
export const normalizeQueryResults = {
  /**
   * 提取页面标题列表
   */
  toPageTitles: (results: any[][]): string[] => {
    return results.map(result => result[0]).filter(Boolean);
  },

  /**
   * 提取 UID 列表
   */
  toUids: (results: any[][]): string[] => {
    return results.map(result => result[0]).filter(Boolean);
  },

  /**
   * 提取页面标题到 UID 的映射
   */
  toPageTitleUidMap: (results: any[][]): Record<string, string> => {
    const map: Record<string, string> = {};
    results.forEach(([title, uid]) => {
      if (title && uid) {
        map[title] = uid;
      }
    });
    return map;
  }
};