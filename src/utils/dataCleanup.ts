import * as queries from '~/queries';
import { CompleteRecords } from '~/models/session';
import { ArrayPriorityManager } from '~/utils/ArrayPriorityManager';

interface ValidationResult {
  validUids: string[];
  orphanedUids: string[];
  practiceRecords: number;
  storageSize: string;
  orphanedCount: number;
}

interface CleanupResult {
  orphanedCount: number;
  cleanedCount: number;
  errors: string[];
}

/**
 * Validates which card UIDs are orphaned (blocks no longer exist in Roam)
 */
const validateBlocksExistence = async (
  cardUids: string[],
  batchSize: number = 50
): Promise<{
  validUids: string[];
  orphanedUids: string[];
}> => {
  const validUids: string[] = [];
  const orphanedUids: string[] = [];
  
  // Process in batches to avoid overwhelming the database
  for (let i = 0; i < cardUids.length; i += batchSize) {
    const batch = cardUids.slice(i, i + batchSize);
    
    for (const uid of batch) {
      const blockInfo = await queries.fetchBlockInfo(uid);
      if (blockInfo && blockInfo.string !== undefined) {
        validUids.push(uid);
      } else {
        orphanedUids.push(uid);
      }
    }
    
    // Yield control to prevent blocking UI
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  return { validUids, orphanedUids };
};

/**
 * Estimates storage size of orphaned data
 */
const estimateStorageSize = (practiceData: CompleteRecords, orphanedUids: string[]): string => {
  let totalRecords = 0;
  
  for (const uid of orphanedUids) {
    if (practiceData[uid]) {
      totalRecords += practiceData[uid].length;
    }
  }
  
  // Rough estimate: each record is about 200 bytes
  const estimatedBytes = totalRecords * 200;
  
  if (estimatedBytes < 1024) {
    return `${estimatedBytes} B`;
  } else if (estimatedBytes < 1024 * 1024) {
    return `${(estimatedBytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
};

/**
 * Validates orphaned data and returns statistics
 */
export const validateOrphanedData = async (
  dataPageTitle: string,
  batchSize: number = 50
): Promise<ValidationResult> => {
  try {
    // 1. Load all practice data
    const practiceData = (await queries.getPluginPageData({
      dataPageTitle,
      limitToLatest: false
    })) as CompleteRecords;
    
    const practiceDataUids = Object.keys(practiceData);
    
    if (practiceDataUids.length === 0) {
      return {
        validUids: [],
        orphanedUids: [],
        practiceRecords: 0,
        storageSize: '0 B',
        orphanedCount: 0
      };
    }
    
    // 2. Validate block existence in batches
    const validationResults = await validateBlocksExistence(practiceDataUids, batchSize);
    
    // 3. Count practice records for orphaned cards
    let orphanedPracticeRecords = 0;
    for (const uid of validationResults.orphanedUids) {
      if (practiceData[uid]) {
        orphanedPracticeRecords += practiceData[uid].length;
      }
    }
    
    // 4. Estimate storage size
    const storageSize = estimateStorageSize(practiceData, validationResults.orphanedUids);
    
    return {
      validUids: validationResults.validUids,
      orphanedUids: validationResults.orphanedUids,
      practiceRecords: orphanedPracticeRecords,
      storageSize,
      orphanedCount: validationResults.orphanedUids.length
    };
  } catch (error) {
    console.error('验证孤立数据失败:', error);
    throw new Error(`验证失败: ${error.message}`);
  }
};

/**
 * Cleans up practice data for orphaned cards
 */
const cleanupPracticeData = async (
  dataPageTitle: string, 
  orphanedUids: string[]
): Promise<void> => {
  try {
    const dataPageUid = await queries.getOrCreatePage(dataPageTitle);
    const dataBlockUid = await queries.getOrCreateBlockOnPage(dataPageTitle, 'data', -1);
    
    // Get all child blocks of the data section
    const dataBlocks = await window.roamAlphaAPI.q(
      `[:find ?uid ?string
        :in $ ?parent-uid  
        :where 
          [?parent :block/uid ?parent-uid]
          [?parent :block/children ?child]
          [?child :block/uid ?uid]
          [?child :block/string ?string]]`,
      dataBlockUid
    );
    
    // Find and delete blocks that reference orphaned UIDs
    for (const [blockUid, blockString] of dataBlocks) {
      // Check if this block references an orphaned card
      const referencedUid = blockString.match(/\(\(([^)]+)\)\)/);
      if (referencedUid && orphanedUids.includes(referencedUid[1])) {
        try {
          await window.roamAlphaAPI.deleteBlock({ block: { uid: blockUid } });
        } catch (error) {
          console.warn(`删除块 ${blockUid} 失败:`, error);
        }
      }
    }
  } catch (error) {
    console.error('清理练习数据失败:', error);
    throw new Error(`清理练习数据失败: ${error.message}`);
  }
};

/**
 * Cleans up priority order arrays by removing orphaned UIDs
 */
const cleanupPriorityOrder = async (
  dataPageTitle: string, 
  orphanedUids: string[]
): Promise<void> => {
  try {
    // Load current priority order
    const priorityOrder = await queries.loadPriorityOrder({ dataPageTitle });
    
    if (Array.isArray(priorityOrder) && priorityOrder.length > 0) {
      // Use ArrayPriorityManager to remove orphaned UIDs
      const manager = ArrayPriorityManager.fromSerialized(priorityOrder);
      manager.removeOrphanedUids(orphanedUids);
      
      // Save cleaned priority order
      await queries.savePriorityOrder({
        dataPageTitle,
        priorityOrder: manager.serialize()
      });
    }
  } catch (error) {
    console.error('清理优先级数组失败:', error);
    throw new Error(`清理优先级数组失败: ${error.message}`);
  }
};

/**
 * Cleans up cache data for orphaned cards
 */
const cleanupCacheData = async (
  dataPageTitle: string,
  orphanedUids: string[]
): Promise<void> => {
  try {
    const dataPageUid = await queries.getOrCreatePage(dataPageTitle);
    const cacheBlockUid = await queries.getOrCreateBlockOnPage(dataPageTitle, 'cache', -1);
    
    // Get all child blocks of the cache section
    const cacheBlocks = await window.roamAlphaAPI.q(
      `[:find ?uid ?string
        :in $ ?parent-uid  
        :where 
          [?parent :block/uid ?parent-uid]
          [?parent :block/children ?child]
          [?child :block/uid ?uid]
          [?child :block/string ?string]]`,
      cacheBlockUid
    );
    
    // Clean up cache entries that might reference orphaned cards
    for (const [blockUid, blockString] of cacheBlocks) {
      // This is a simplified cleanup - in practice, you might want more sophisticated logic
      // to determine if a cache entry is related to orphaned cards
      const hasOrphanedReference = orphanedUids.some(uid => 
        blockString.includes(uid) || blockString.includes(`((${uid}))`)
      );
      
      if (hasOrphanedReference) {
        try {
          await window.roamAlphaAPI.deleteBlock({ block: { uid: blockUid } });
        } catch (error) {
          console.warn(`删除缓存块 ${blockUid} 失败:`, error);
        }
      }
    }
  } catch (error) {
    console.error('清理缓存数据失败:', error);
    // Don't throw here - cache cleanup is not critical
  }
};

/**
 * Main cleanup function that removes orphaned data
 */
export const cleanupOrphanedData = async ({
  dataPageTitle,
  dryRun = true,
  batchSize = 50
}: {
  dataPageTitle: string;
  dryRun?: boolean;
  batchSize?: number;
}): Promise<CleanupResult> => {
  const result: CleanupResult = {
    orphanedCount: 0,
    cleanedCount: 0,
    errors: []
  };

  try {
    // 1. First validate to get orphaned data
    const validationResult = await validateOrphanedData(dataPageTitle, batchSize);
    
    result.orphanedCount = validationResult.orphanedCount;
    
    if (dryRun) {
      return result;
    }
    
    if (validationResult.orphanedUids.length === 0) {
      return result;
    }
    
    // 2. Clean practice data
    await cleanupPracticeData(dataPageTitle, validationResult.orphanedUids);
    
    // 3. Clean priority order by removing orphaned UIDs
    await cleanupPriorityOrder(dataPageTitle, validationResult.orphanedUids);
    
    // 4. Clean cache data (optional, non-critical)
    await cleanupCacheData(dataPageTitle, validationResult.orphanedUids);
    
    result.cleanedCount = validationResult.orphanedUids.length;
    
  } catch (error) {
    console.error('清理失败:', error);
    result.errors.push(error.message);
  }
  
  return result;
};

/**
 * Utility function to get basic cleanup statistics without full validation
 */
export const getCleanupStats = async (dataPageTitle: string): Promise<{
  totalCards: number;
  hasOrphanedData: boolean;
}> => {
  try {
    const practiceData = (await queries.getPluginPageData({
      dataPageTitle,
      limitToLatest: false
    })) as CompleteRecords;
    
    const totalCards = Object.keys(practiceData).length;
    
    // Quick check: sample a few cards to see if any are orphaned
    const sampleUids = Object.keys(practiceData).slice(0, 10);
    let hasOrphanedData = false;
    
    for (const uid of sampleUids) {
      try {
        const blockInfo = await queries.fetchBlockInfo(uid);
        if (!blockInfo || blockInfo.string === undefined) {
          hasOrphanedData = true;
          break;
        }
      } catch (error) {
        hasOrphanedData = true;
        break;
      }
    }
    
    return { totalCards, hasOrphanedData };
  } catch (error) {
    console.error('获取清理统计失败:', error);
    return { totalCards: 0, hasOrphanedData: false };
  }
};