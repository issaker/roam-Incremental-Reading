import { NewSession, ReviewModes, IntervalMultiplierType } from '~/models/session';

export const parentChainInfoQuery = `[
  :find (pull ?parentIds [
    :node/title
    :block/string
    :block/uid])
  :in $ ?refId
  :where
    [?block :block/uid ?refId]
    [?block :block/parents ?parentIds]
  ]`;

const getParentChainInfo = async ({ refUid }) => {
  const dataResults = await window.roamAlphaAPI.q(parentChainInfoQuery, refUid);

  return dataResults.map((r) => r[0]);
};

export interface BlockInfo {
  string: string;
  children: any[];
  childrenUids?: string[];
  breadcrumbs: Breadcrumbs[];

  refUid: string;
}
export interface Breadcrumbs {
  [index: number]: { uid: string; title: string };
}

export const blockInfoQuery = `[
  :find (pull ?block [
    :block/string
    :block/children
    {:block/children [:block/uid :block/string :block/order]}])
  :in $ ?refId
  :where
    [?block :block/uid ?refId]
  ]`;
export const fetchBlockInfo: (refUid: any) => Promise<BlockInfo | null> = async (refUid) => {
  try {
    const result = await window.roamAlphaAPI.q(blockInfoQuery, refUid);
    if (!result || !result[0] || !result[0][0]) {
      return null; // 明确返回 null 表示块不存在
    }
    
    const blockInfo = result[0][0];
    const parentChainInfo = await getParentChainInfo({ refUid });

    const sortedChildren = blockInfo.children?.sort((a, b) => a.order - b.order);

    return {
      string: blockInfo.string,
      children: sortedChildren?.map((child) => child.string),
      childrenUids: sortedChildren?.map((child) => child.uid),
      breadcrumbs: parentChainInfo,
      refUid,
    };
  } catch (error) {
    console.warn(`获取块信息失败 ${refUid}:`, error);
    return null;
  }
};

/**
 *  Shout out to David Bieber for these helpful functions Blog:
 *  https://davidbieber.com/snippets/2021-02-12-javascript-functions-for-inserting-blocks-in-roam/
 */
export const getPageQuery = `[
  :find ?uid :in $ ?title
  :where
    [?page :node/title ?title]
    [?page :block/uid ?uid]
]`;
const getPage = (page) => {
  // returns the uid of a specific page in your graph. _page_: the title of the
  // page.
  const results = window.roamAlphaAPI.q(getPageQuery, page);
  if (results.length) {
    return results[0][0];
  }
};

export const getOrCreatePage = async (pageTitle) => {
  const page = getPage(pageTitle);
  if (page) return page;
  const uid = window.roamAlphaAPI.util.generateUID();
  await window.roamAlphaAPI.data.page.create({ page: { title: pageTitle, uid } });

  return getPage(pageTitle);
};

export const getBlockOnPage = (page, block) => {
  // returns the uid of a specific block on a specific page. _page_: the title
  // of the page. _block_: the text of the block.
  const results = window.roamAlphaAPI.q(
    `
    [:find ?block_uid
     :in $ ?page_title ?block_string
     :where
     [?page :node/title ?page_title]
     [?page :block/uid ?page_uid]
     [?block :block/parents ?page]
     [?block :block/string ?block_string]
     [?block :block/uid ?block_uid]
    ]`,
    page,
    block
  );
  if (results.length) {
    return results[0][0];
  }
};

export const getChildBlock = (
  parent_uid: string,
  block: string,
  options: {
    exactMatch?: boolean;
  } = {
    exactMatch: true,
  }
) => {
  // returns the uid of a specific child block underneath a specific parent
  // block. _parent_uid_: the uid of the parent block. _block_: the text of the
  // child block.
  const exactMatchQuery = `
    [:find ?block_uid
    :in $ ?parent_uid ?block_string
    :where
      [?parent :block/uid ?parent_uid]
      [?block :block/parents ?parent]
      [?block :block/string ?block_string]
      [?block :block/uid ?block_uid]
    ]
  `;

  const startsWithQuery = `
    [:find ?block_uid
      :in $ ?parent_uid ?block_sub_string
      :where
        [?parent :block/uid ?parent_uid]
        [?block :block/parents ?parent]
        [?block :block/string ?block_string]
        [(clojure.string/starts-with? ?block_string ?block_sub_string)]
        [?block :block/uid ?block_uid]
    ]
  `;

  const query = options.exactMatch ? exactMatchQuery : startsWithQuery;

  const results = window.roamAlphaAPI.q(query, parent_uid, block);
  if (results.length) {
    return results[0][0];
  }
};

export const childBlocksOnPageQuery = `[
  :find (pull ?tagPage [
    :block/uid
    :block/string
    :block/children
    {:block/children ...}])
  :in $ ?tag
  :where
    [?tagPage :node/title ?tag]
    [?tagPage :block/children ?tagPageChildren]
  ]`;
export const getChildBlocksOnPage = (page) => {
  const queryResults = window.roamAlphaAPI.q(childBlocksOnPageQuery, page);

  if (!queryResults.length) return [];

  return queryResults;
};

// 🎯 NEW: 获取指定block的子blocks
export const childBlocksByUidQuery = `[
  :find (pull ?child [
    :block/uid
    :block/string
    :block/order])
  :in $ ?parent_uid
  :where
    [?parent :block/uid ?parent_uid]
    [?parent :block/children ?child]
  ]`;

export const getChildBlocksByUid = (parentUid: string) => {
  try {
    const queryResults = window.roamAlphaAPI.q(childBlocksByUidQuery, parentUid);
    
    if (!queryResults.length) return [];
    
    // 返回格式化的子blocks，按order排序
    const childBlocks = queryResults.map(result => result[0]).sort((a, b) => a.order - b.order);
    
    return childBlocks;
  } catch (error) {
    console.error('getChildBlocksByUid 失败:', error);
    return [];
  }
};

export const createChildBlock = async (parent_uid, block, order, blockProps = {}) => {
  // returns the uid of a specific child block underneath a specific parent
  // block, creating it first if it's not already there. _parent_uid_: the uid
  // of the parent block. _block_: the text of the child block. _order_:
  // (optional) controls where to create the block, 0 for inserting at the top,
  // -1 for inserting at the bottom.
  if (!order) {
    order = 0;
  }

  const uid = window.roamAlphaAPI.util.generateUID();
  await window.roamAlphaAPI.createBlock({
    location: { 'parent-uid': parent_uid, order: order },
    block: { string: block, uid, ...blockProps },
  });

  return uid;
};

export const createBlockOnPage = async (page, block, order, blockProps) => {
  // creates a new top-level block on a specific page, returning the new block's
  // uid. _page_: the title of the page. _block_: the text of the block.
  // _order_: (optional) controls where to create the block, 0 for top of page,
  // -1 for bottom of page.
  const page_uid = getPage(page);
  return createChildBlock(page_uid, block, order, blockProps);
};

export const getOrCreateBlockOnPage = async (page, block, order, blockProps) => {
  // returns the uid of a specific block on a specific page, creating it first
  // as a top-level block if it's not already there. _page_: the title of the
  // page. _block_: the text of the block. _order_: (optional) controls where to
  // create the block, 0 for top of page, -1 for bottom of page.
  const block_uid = getBlockOnPage(page, block);
  if (block_uid) return block_uid;
  return createBlockOnPage(page, block, order, blockProps);
};

export const getOrCreateChildBlock = async (parent_uid, block, order, blockProps) => {
  // creates a new child block underneath a specific parent block, returning the
  // new block's uid. _parent_uid_: the uid of the parent block. _block_: the
  // text of the new block. _order_: (optional) controls where to create the
  // block, 0 for inserting at the top, -1 for inserting at the bottom.
  const block_uid = getChildBlock(parent_uid, block);
  if (block_uid) return block_uid;
  return createChildBlock(parent_uid, block, order, blockProps);
};

export const generateNewSession = ({
  reviewMode = ReviewModes.FixedInterval, // 默认改为 FIX 模式
  dateCreated = undefined,
  isNew = true,
} = {}): NewSession => {
  if (reviewMode === ReviewModes.DefaultSpacedInterval) {
    return {
      dateCreated: dateCreated || new Date(),
      eFactor: 2.5,
      interval: 0,
      repetitions: 0,
      isNew,
      reviewMode,
    };
  }

  // FIX 模式（手动间隔重复）
  return {
    dateCreated: dateCreated || new Date(),
    intervalMultiplier: 3,
    intervalMultiplierType: IntervalMultiplierType.Days,
    isNew,
    reviewMode,
  };
};

// 🚀 NEW: 根据页面标题批量获取UID
export const getPageUidsFromTitles = (titles: string[]): string[] => {
  if (!titles || titles.length === 0) {
    return [];
  }
  
  const query = `[
    :find [?uid ...]
    :in $ [?title ...]
    :where
      [?page :node/title ?title]
      [?page :block/uid ?uid]
  ]`;
  try {
    const results = window.roamAlphaAPI.q(query, titles);
    return results || [];
  } catch (e) {
    console.error("Error in getPageUidsFromTitles:", e);
    return [];
  }
};

/**
 * Gets all the child blocks on a page
 * @param {string} pageName - The name of the page to get the blocks from
 */
// export const getChildBlocksOnPage = async (pageName: string) => {
//   const queryResults = await window.roamAlphaAPI.q(childBlocksOnPageQuery, pageName);

//   if (!queryResults.length) return [];

//   return queryResults;
// };
