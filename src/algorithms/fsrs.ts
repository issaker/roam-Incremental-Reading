import { fsrs, generatorParameters, createEmptyCard, Grade, Rating, State } from 'ts-fsrs';

// FSRS配置
const f = fsrs(generatorParameters());

// 将应用的grade (0-5) 映射到FSRS的Rating
const mapGradeToRating = (grade: number): number => {
  switch (grade) {
    case 0: return 1; // Manual/Again - 完全忘记
    case 1: return 1; // Again - 错误
    case 2: return 2; // Hard - 困难
    case 3: return 3; // Good - 一般
    case 4: return 3; // Good - 良好
    case 5: return 4; // Easy - 简单
    default: return 3; // Good
  }
};

// FSRS适配器接口，模拟SM2的返回格式
export interface FSRSResult {
  interval: number;
  repetition: number;
  efactor: number;
  fsrsState?: any; // 存储FSRS内部状态
}

// FSRS算法实现，返回与SM2兼容的接口
export const fsrsAlgorithm = (item: any, grade: number): FSRSResult => {
  try {
    // 从item中提取FSRS状态，如果没有则创建新卡片
    let card;
    if (item.fsrsState) {
      // 恢复已有的FSRS卡片状态
      // 如果是字符串，尝试解析为JSON对象
      if (typeof item.fsrsState === 'string') {
        try {
          card = JSON.parse(item.fsrsState);
        } catch (e) {
          console.warn('FSRS状态解析失败，创建新卡片:', e);
          card = createEmptyCard();
        }
      } else {
        card = item.fsrsState;
      }
    } else {
      // 创建新的FSRS卡片
      card = createEmptyCard();
    }

    // 转换评分
    const rating = mapGradeToRating(grade);
    
    // 执行FSRS调度
    const now = new Date();
    const schedulingCards = f.repeat(card, now);
    const nextCard = schedulingCards[rating];
    
    if (!nextCard || !nextCard.card || !nextCard.card.due) {
      throw new Error(`FSRS调度失败: 无法获取有效的nextCard.card`);
    }

    // 提取实际的卡片数据
    const actualCard = nextCard.card;
    
    // 计算下次复习间隔（天数）
    const intervalMs = actualCard.due.getTime() - now.getTime();
    const intervalDays = Math.max(0, Math.round(intervalMs / (1000 * 60 * 60 * 24)));

    console.log('✅ FSRS算法成功:', {
      intervalDays,
      nextDue: actualCard.due.toISOString()
    });

    // 转换为SM2兼容的格式
    return {
      interval: intervalDays,
      repetition: actualCard.reps,
      efactor: actualCard.stability, // 使用stability作为efactor的近似
      fsrsState: actualCard, // 保存FSRS卡片状态
    };
  } catch (error) {
    console.error('FSRS算法执行错误:', error);
    // 降级到基本调度
    return {
      interval: grade >= 3 ? Math.max(1, (item.interval || 1) * 2) : 1,
      repetition: (item.repetition || 0) + 1,
      efactor: item.efactor || 2.5,
    };
  }
};

export default fsrsAlgorithm; 