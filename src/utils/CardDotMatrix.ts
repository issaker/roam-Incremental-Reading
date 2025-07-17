/**
 * 卡片点阵图数据结构和坐标映射算法
 */

import { Session, RecordUid, CompleteRecords } from '~/models/session';
import { Today } from '~/models/practice';

// 点阵图中的卡片点位
export interface CardDot {
  uid: RecordUid;
  deckName: string;
  x: number;        // X坐标 (0-100): 优先级映射
  y: number;        // Y坐标 (0-100): 到期天数映射
  dueDate: Date;    // 实际到期日期
  daysToDue: number; // 距离到期的天数
  priority: number; // 优先级值
  isOverdue: boolean; // 是否过期
  isNew: boolean;   // 是否是新卡片
}

// 点阵图配置
export interface DotMatrixConfig {
  maxDays: number;          // Y轴最大天数范围 (默认30天)
  priorityRange: number;    // X轴优先级范围 (默认100)
  dotSize: number;          // 点位大小 (默认4px)
  canvasWidth: number;      // Canvas宽度
  canvasHeight: number;     // Canvas高度
  marginX: number;          // X轴边距
  marginY: number;          // Y轴边距
}

// 默认配置
export const defaultDotMatrixConfig: DotMatrixConfig = {
  maxDays: 30,
  priorityRange: 100,
  dotSize: 4,
  canvasWidth: 800,
  canvasHeight: 400,
  marginX: 80,
  marginY: 50,
};

/**
 * 计算卡片的到期天数
 */
export const calculateDaysToDue = (dueDate: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * 从Session数据中获取下次到期日期
 */
export const getNextDueDate = (sessions: Session[]): Date => {
  if (!sessions || sessions.length === 0) {
    return new Date(); // 新卡片，今天到期
  }
  
  const latestSession = sessions[sessions.length - 1];
  return latestSession.nextDueDate || new Date();
};

/**
 * 将天数映射到Y坐标 (0-100)
 */
export const mapDaysToY = (daysToDue: number, config: DotMatrixConfig): number => {
  if (daysToDue <= 0) return 0; // 过期或今天到期
  if (daysToDue >= config.maxDays) return 100; // 超出范围
  
  return (daysToDue / config.maxDays) * 100;
};

/**
 * 将优先级映射到X坐标 (0-100)
 */
export const mapPriorityToX = (priority: number, config: DotMatrixConfig): number => {
  // 优先级越高，X坐标越高
  return Math.max(0, Math.min(100, priority));
};

/**
 * 将逻辑坐标转换为Canvas坐标
 */
export const logicalToCanvas = (
  x: number, 
  y: number, 
  config: DotMatrixConfig
): { canvasX: number; canvasY: number } => {
  const plotWidth = config.canvasWidth - 2 * config.marginX;
  const plotHeight = config.canvasHeight - 2 * config.marginY;
  
  return {
    canvasX: config.marginX + (x / 100) * plotWidth,
    canvasY: config.marginY + ((100 - y) / 100) * plotHeight, // Y轴反转
  };
};

/**
 * 生成点阵图数据
 */
export const generateDotMatrixData = (
  practiceData: CompleteRecords,
  cardUids: Record<string, RecordUid[]>,
  priorityOrder: RecordUid[],
  today: Today,
  config: DotMatrixConfig = defaultDotMatrixConfig
): CardDot[] => {
  const dots: CardDot[] = [];
  
  // 为每个牌组的卡片生成点位数据
  Object.entries(cardUids).forEach(([deckName, uids]) => {
    uids.forEach(uid => {
      const sessions = practiceData[uid] || [];
      const dueDate = getNextDueDate(sessions);
      const daysToDue = calculateDaysToDue(dueDate);
      
      // 从优先级顺序中获取优先级
      const priorityIndex = priorityOrder.indexOf(uid);
      const priority = priorityIndex === -1 ? 50 : 
        ((priorityOrder.length - priorityIndex) / priorityOrder.length) * 100;
      
      // 检查是否是新卡片
      const isNew = sessions.length === 0;
      
      // 检查是否过期
      const isOverdue = daysToDue < 0;
      
      const dot: CardDot = {
        uid,
        deckName,
        x: mapPriorityToX(priority, config),
        y: mapDaysToY(daysToDue, config),
        dueDate,
        daysToDue,
        priority,
        isOverdue,
        isNew,
      };
      
      dots.push(dot);
    });
  });
  
  return dots;
};

/**
 * 按牌组筛选点位数据
 */
export const filterDotsByDeck = (dots: CardDot[], deckName: string): CardDot[] => {
  return dots.filter(dot => dot.deckName === deckName);
};

/**
 * 计算牌组的边界框
 */
export const getDeckBounds = (dots: CardDot[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} => {
  if (dots.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }
  
  return {
    minX: Math.min(...dots.map(d => d.x)),
    maxX: Math.max(...dots.map(d => d.x)),
    minY: Math.min(...dots.map(d => d.y)),
    maxY: Math.max(...dots.map(d => d.y)),
  };
};

/**
 * 应用牌组偏移和缩放
 */
export const applyDeckTransform = (
  dots: CardDot[],
  xOffset: number,
  xScale: number
): CardDot[] => {
  if (dots.length === 0) return dots;
  
  const bounds = getDeckBounds(dots);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  
  return dots.map(dot => ({
    ...dot,
    x: Math.max(0, Math.min(100, 
      centerX + (dot.x - centerX) * xScale + xOffset
    ))
  }));
};

/**
 * 生成时间轴标签
 */
export const generateTimeAxisLabels = (config: DotMatrixConfig): {
  position: number;
  label: string;
}[] => {
  const labels: { position: number; label: string }[] = [];
  
  // 今天
  labels.push({ position: 0, label: '今天' });
  
  // 未来的日期
  for (let days = 7; days <= config.maxDays; days += 7) {
    const y = mapDaysToY(days, config);
    labels.push({
      position: y,
      label: `${days}天`
    });
  }
  
  return labels;
};

/**
 * 生成优先级轴标签
 */
export const generatePriorityAxisLabels = (config: DotMatrixConfig): {
  position: number;
  label: string;
}[] => {
  const labels: { position: number; label: string }[] = [];
  
  for (let priority = 0; priority <= 100; priority += 25) {
    // 不再应用偏移
    labels.push({
      position: priority,
      label: `${priority}%`
    });
  }
  
  return labels;
};