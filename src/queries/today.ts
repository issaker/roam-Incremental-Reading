import * as dateUtils from '~/utils/date';
import * as objectUtils from '~/utils/object';
import { CompleteRecords, RecordUid, Session } from '~/models/session';
import { CompletionStatus, RenderMode, Today, TodayInitial } from '~/models/practice';
import { generateNewSession } from '~/queries/utils';

export const initializeToday = ({ tagsList, cachedData }) => {
  const today: Today = objectUtils.deepClone(TodayInitial);

  for (const tag of tagsList) {
    const cachedTagData = cachedData?.[tag];

    today.tags[tag] = {
      status: CompletionStatus.Unstarted,
      completed: 0,
      due: 0,
      new: 0,
      newUids: [],
      dueUids: [],
      completedUids: [],
      completedDue: 0,
      completedNew: 0,
      completedDueUids: [],
      completedNewUids: [],
      renderMode: cachedTagData?.renderMode || RenderMode.Normal,
    };
  }

  return today;
};

export const calculateTodayStatus = ({ today, tagsList }) => {
  // Calculate the status of each tag
  for (const tag of tagsList) {
    const completed = today.tags[tag].completed;
    const remaining = today.tags[tag].new + today.tags[tag].due;

    if (remaining === 0) {
      today.tags[tag].status = CompletionStatus.Finished;
    } else if (completed > 0) {
      today.tags[tag].status = CompletionStatus.Partial;
    } else {
      today.tags[tag].status = CompletionStatus.Unstarted;
    }
  }

  // Calculate the status of the combined counts
  const completed = today.combinedToday.completed;
  const remaining = today.combinedToday.new + today.combinedToday.due;

  if (remaining === 0) {
    today.combinedToday.status = CompletionStatus.Finished;
  } else if (completed > 0) {
    today.combinedToday.status = CompletionStatus.Partial;
  } else {
    today.combinedToday.status = CompletionStatus.Unstarted;
  }
};

/**
 * Adds data for all the cards practised today
 */
export const calculateCompletedTodayCounts = async ({ today, tagsList, sessionData }) => {
  for (const tag of tagsList) {
    let count = 0;
    const completedUids = [];
    const completedDueUids = [];
    const completedNewUids = [];

    const currentTagSessionData = sessionData[tag];
    Object.keys(currentTagSessionData).forEach((cardUid) => {
      const cardData = currentTagSessionData[cardUid];
      const latestSession = cardData[cardData.length - 1];
      const isCompletedToday =
        latestSession && dateUtils.isSameDay(latestSession.dateCreated, new Date());

      if (isCompletedToday) {
        const isFirstSession = cardData.length === 1;
        const wasDueToday = !isFirstSession;
        const wasNew = isFirstSession;

        count++;
        completedUids.push(cardUid);
        if (wasDueToday) completedDueUids.push(cardUid);
        if (wasNew) completedNewUids.push(cardUid);
      }
    });

    today.tags[tag] = {
      ...(today.tags[tag] || {}),
      completed: count,
      completedUids,
      completedDueUids,
      completedNewUids,
      completedDue: completedDueUids.length,
      completedNew: completedNewUids.length,
    };
  }

  return today;
};

export const calculateCombinedCounts = ({ today, tagsList }) => {
  // Reset combined counts
  const todayInitial: Today = objectUtils.deepClone(TodayInitial);

  today.combinedToday = todayInitial.combinedToday;

  for (const tag of tagsList) {
    today.combinedToday.due += today.tags[tag].due;
    today.combinedToday.new += today.tags[tag].new;
    today.combinedToday.dueUids = today.combinedToday.dueUids.concat(today.tags[tag].dueUids);
    today.combinedToday.newUids = today.combinedToday.newUids.concat(today.tags[tag].newUids);
    today.combinedToday.completed += today.tags[tag].completed;
    today.combinedToday.completedUids = today.combinedToday.completedUids.concat(
      today.tags[tag].completedUids
    );
    today.combinedToday.completedDue += today.tags[tag].completedDue;
    today.combinedToday.completedDueUids = today.combinedToday.completedDueUids.concat(
      today.tags[tag].completedDueUids
    );
    today.combinedToday.completedNew += today.tags[tag].completedNew;
    today.combinedToday.completedNewUids = today.combinedToday.completedNewUids.concat(
      today.tags[tag].completedNewUids
    );
  }

  // 🚀 FIXED: 对合并后的UID列表进行去重，并基于去重后的结果重新计算总数，确保数据一致性
  today.combinedToday.dueUids = [...new Set(today.combinedToday.dueUids)];
  today.combinedToday.newUids = [...new Set(today.combinedToday.newUids)];
  today.combinedToday.completedUids = [...new Set(today.combinedToday.completedUids)];
  today.combinedToday.completedDueUids = [...new Set(today.combinedToday.completedDueUids)];
  today.combinedToday.completedNewUids = [...new Set(today.combinedToday.completedNewUids)];

  today.combinedToday.due = today.combinedToday.dueUids.length;
  today.combinedToday.new = today.combinedToday.newUids.length;
  today.combinedToday.completed = today.combinedToday.completedUids.length;
  today.combinedToday.completedDue = today.combinedToday.completedDueUids.length;
  today.combinedToday.completedNew = today.combinedToday.completedNewUids.length;
};

/**
 * Create new cards for all referenced cards with no session data yet
 */
export const addNewCards = ({
  today,
  tagsList,
  cardUids,
  pluginPageData,
  priorityOrder = [],
}: {
  today: Today;
  tagsList: string[];
  cardUids: Record<string, RecordUid[]>;
  pluginPageData: CompleteRecords;
  priorityOrder?: string[];
}) => {
  const rankMap = createRankMap(priorityOrder);
  for (const currentTag of tagsList) {
    const allSelectedTagCardsUids = cardUids[currentTag];
    const newCardsUids: RecordUid[] = [];

    allSelectedTagCardsUids.forEach((referenceId) => {
      if (!pluginPageData[referenceId] || !pluginPageData[referenceId].length) {
        // New
        newCardsUids.push(referenceId);
        pluginPageData[referenceId] = [generateNewSession()];
      }
    });

    if (rankMap) {
      const getRank = (uid: string) => rankMap.get(uid) ?? Number.MAX_SAFE_INTEGER;
      newCardsUids.sort((a, b) => getRank(a) - getRank(b));
    }

    today.tags[currentTag] = {
      ...today.tags[currentTag],
      newUids: newCardsUids,
      new: newCardsUids.length,
    };
  }
};

const createRankMap = (priorityOrder: string[]): Map<string, number> | null => {
  if (!priorityOrder || priorityOrder.length === 0) return null;
  const m = new Map<string, number>();
  priorityOrder.forEach((uid, i) => m.set(uid, i));
  return m;
};

export const getDueCardUids = (currentTagSessionData: CompleteRecords, isCramming, priorityOrder: string[] = []) => {
  const results: RecordUid[] = [];
  if (!Object.keys(currentTagSessionData).length) return results;

  const rankMap = createRankMap(priorityOrder);

  const now = new Date();
  Object.keys(currentTagSessionData).forEach((cardUid) => {
    const cardData = currentTagSessionData[cardUid] as Session[];

    const latestSession = cardData[cardData.length - 1];
    if (!latestSession) return;

    const nextDueDate = latestSession.nextDueDate;

    if (isCramming || (nextDueDate && nextDueDate <= now)) {
      results.push(cardUid as RecordUid);
    }
  });

  // 按排名列表进行排序
  if (rankMap) {
    const getRank = (uid: string) => rankMap.get(uid) ?? Number.MAX_SAFE_INTEGER;
    results.sort((a, b) => getRank(a) - getRank(b));
  }

  return results;
};

export const addDueCards = ({ today, tagsList, sessionData, isCramming, priorityOrder = [] }) => {
  const rankMap = createRankMap(priorityOrder);
  for (const currentTag of tagsList) {
    const currentTagSessionData = sessionData[currentTag];
    const dueCardsUids = getDueCardUids(currentTagSessionData, isCramming, priorityOrder);

    if (rankMap) {
      const getRank = (uid: string) => rankMap.get(uid) ?? Number.MAX_SAFE_INTEGER;
      dueCardsUids.sort((a, b) => getRank(a) - getRank(b));
    }

    today.tags[currentTag] = {
      ...today.tags[currentTag],
      dueUids: dueCardsUids,
      due: dueCardsUids.length,
    };
  }
};

/**
 * Here we're adding back completed cards to counts. This is so we can compute
 * the initial distribution of cards (the distribution before we completed
 * cards). This allows us to maintain the same distribution on re-runs (enabling
 * features like partial completions that don't redistribute everytime)
 */
export const restoreCompletedUids = ({ today, tagsList }) => {
  for (const currentTag of tagsList) {
    today.tags[currentTag].newUids.push(...today.tags[currentTag].completedNewUids);
    today.tags[currentTag].dueUids.push(...today.tags[currentTag].completedDueUids);
    today.tags[currentTag].new = today.tags[currentTag].newUids.length;
    today.tags[currentTag].due = today.tags[currentTag].dueUids.length;
  }
};
