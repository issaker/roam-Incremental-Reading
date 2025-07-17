import { savePracticeData } from '~/queries';
import * as dateUtils from '~/utils/date';
import { IntervalMultiplierType, ReviewModes, Session } from '~/models/session';
import { fsrsAlgorithm } from '~/algorithms/fsrs';

export const supermemo = (item, grade) => {
  let nextInterval;
  let nextRepetition;
  let nextEfactor;

  if (grade === 0) {
    // If we completely forgot we should review again ASAP.
    nextInterval = 0;
    nextRepetition = 0;
    nextEfactor = item.efactor; // ✅ 修复Bug: 必须设置EF
  } else if (grade < 3) {
    nextInterval = 1;
    nextRepetition = 0;
    nextEfactor = item.efactor; // 保持EF不变，符合官方规范
  } else {
    // ✅ 成功时正常计算间隔
    if (item.repetition === 0) {
      nextInterval = 1;
      nextRepetition = 1;
    } else if (item.repetition === 1) {
      nextInterval = 6;
      nextRepetition = 2;
    } else {
      // ✅ 修正公式：严格按照官方规范 I(n) = I(n-1) * EF
      // 移除错误的 * (grade / 5) 因子
      nextInterval = Math.round(item.interval * item.efactor);
      nextRepetition = item.repetition + 1;
    }
    
    // ✅ 只有成功时才更新EF，符合官方逻辑
    nextEfactor = item.efactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (nextEfactor < 1.3) nextEfactor = 1.3;
  }

  return {
    interval: nextInterval,
    repetition: nextRepetition,
    efactor: nextEfactor,
  };
};

type PracticeDataResult = Session & {
  nextDueDateFromNow?: string;
};
export const generatePracticeData = ({
  dateCreated,
  reviewMode,
  schedulingAlgorithm = 'SM2',
  ...props
}: Session & { schedulingAlgorithm?: 'SM2' | 'FSRS' }): PracticeDataResult => {
  const shared = {
    reviewMode,
  };

  // 协同排名系统：不再保存priority字段到session数据中

  if (reviewMode === ReviewModes.FixedInterval) {
    const { intervalMultiplier, intervalMultiplierType } = props;
    const today = new Date();
    let nextDueDate = null;
    if (intervalMultiplierType === IntervalMultiplierType.Days) {
      nextDueDate = dateUtils.addDays(today, intervalMultiplier);
    } else if (intervalMultiplierType === IntervalMultiplierType.Weeks) {
      nextDueDate = dateUtils.addDays(today, intervalMultiplier * 7);
    } else if (intervalMultiplierType === IntervalMultiplierType.Months) {
      nextDueDate = dateUtils.addDays(today, intervalMultiplier * 30);
    } else if (intervalMultiplierType === IntervalMultiplierType.Years) {
      nextDueDate = dateUtils.addDays(today, intervalMultiplier * 365);
    }

    return {
      ...shared,
      reviewMode: ReviewModes.FixedInterval,
      intervalMultiplier,
      intervalMultiplierType,
      nextDueDate,
      nextDueDateFromNow: dateUtils.customFromNow(nextDueDate),
    };
  } else {
    const { grade, interval, repetitions, eFactor, fsrsState } = props;
    
    let algorithmResults;
    if (schedulingAlgorithm === 'FSRS') {
      // 使用FSRS算法
      const fsrsInput = {
        interval,
        repetition: repetitions,
        efactor: eFactor,
        fsrsState,
      };
      algorithmResults = fsrsAlgorithm(fsrsInput, grade);
    } else {
      // 使用默认SM2算法
      const supermemoInput = {
        interval,
        repetition: repetitions,
        efactor: eFactor,
      };
      algorithmResults = supermemo(supermemoInput, grade);
    }

    const nextDueDate = dateUtils.addDays(dateCreated, algorithmResults.interval);

    return {
      ...shared,
      reviewMode: ReviewModes.DefaultSpacedInterval,
      grade,
      repetitions: algorithmResults.repetition,
      interval: algorithmResults.interval,
      eFactor: algorithmResults.efactor,
      // 保存FSRS状态（如果使用FSRS）
      ...(schedulingAlgorithm === 'FSRS' && algorithmResults.fsrsState && {
        fsrsState: algorithmResults.fsrsState,
      }),
      dateCreated,
      nextDueDate,
      nextDueDateFromNow: dateUtils.customFromNow(nextDueDate),
    };
  }
};

export type PracticeProps = Session & {
  refUid: string;
  dataPageTitle: string;
  isCramming?: boolean;
  isDryRun?: boolean;
};

export const practice = async (practiceProps: PracticeProps & { fsrsEnabled?: boolean }) => {

  const {
    refUid,
    dataPageTitle,
    dateCreated,
    isCramming,
    isDryRun,
    grade,
    reviewMode,
    eFactor,
    interval,
    repetitions,
    intervalMultiplier,
    intervalMultiplierType,
    fsrsEnabled = false,
    fsrsState,
  } = practiceProps;


  // Just destructuring nextDueDateFromNow here because I don't want to store it
  const {
    nextDueDateFromNow: nextDueDateFromNowExtracted,
    ...practiceResultData
  } = generatePracticeData({
    dateCreated,
    reviewMode,
    grade,
    eFactor,
    interval,
    repetitions,
    intervalMultiplier,
    intervalMultiplierType,
    schedulingAlgorithm: fsrsEnabled ? 'FSRS' : 'SM2',
    fsrsState,
  });

  if (!isDryRun && !isCramming) {
    await savePracticeData({
      refUid,
      dataPageTitle,
      dateCreated,
      ...practiceResultData,
    });
  } else if (isCramming) {
  } else if (isDryRun) {
  }

  return practiceResultData;
};

export default practice;
