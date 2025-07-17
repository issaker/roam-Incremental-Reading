import * as React from 'react';
import styled from '@emotion/styled';
import { 
  CardDot, 
  DotMatrixConfig, 
  defaultDotMatrixConfig,
  logicalToCanvas,
  generateTimeAxisLabels,
  generatePriorityAxisLabels
} from '~/utils/CardDotMatrix';

interface Props {
  dots: CardDot[];
  config?: DotMatrixConfig;
  selectedDeck?: string;
  onDotClick?: (dot: CardDot) => void;
  onDotHover?: (dot: CardDot | null) => void;
}

const CardDotMatrixCanvas: React.FC<Props> = ({
  dots,
  config = defaultDotMatrixConfig,
  selectedDeck,
  onDotClick,
  onDotHover
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const backgroundCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [hoveredDot, setHoveredDot] = React.useState<CardDot | null>(null);
  const [backgroundNeedsUpdate, setBackgroundNeedsUpdate] = React.useState(true);

  // 绘制坐标轴
  const drawAxes = React.useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#e1e8ed';
    ctx.lineWidth = 1;
    
    // X轴
    ctx.beginPath();
    ctx.moveTo(config.marginX, config.canvasHeight - config.marginY);
    ctx.lineTo(config.canvasWidth - config.marginX, config.canvasHeight - config.marginY);
    ctx.stroke();
    
    // Y轴
    ctx.beginPath();
    ctx.moveTo(config.marginX, config.marginY);
    ctx.lineTo(config.marginX, config.canvasHeight - config.marginY);
    ctx.stroke();
  }, [config]);

  // 绘制轴标签
  const drawAxisLabels = React.useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#5c7080';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    
    // X轴标签 (优先级轴)
    const priorityLabels = generatePriorityAxisLabels(config);
    priorityLabels.forEach(({ position, label }) => {
      const { canvasX } = logicalToCanvas(position, 0, config);
      ctx.fillText(label, canvasX, config.canvasHeight - config.marginY + 20);
    });
    
    // Y轴标签 (时间轴)
    const timeLabels = generateTimeAxisLabels(config);
    ctx.textAlign = 'right';
    timeLabels.forEach(({ position, label }) => {
      const { canvasY } = logicalToCanvas(0, position, config);
      ctx.fillText(label, config.marginX - 15, canvasY + 4);
    });
    
    // Y轴标题 (旋转90度)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#333';
    ctx.translate(20, config.canvasHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('到期时间', 0, 0);
    ctx.restore();
  }, [config]);

  // 绘制网格线
  const drawGrid = React.useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = '#f5f8fa';
    ctx.lineWidth = 1;
    
    // 垂直网格线 (优先级)
    const priorityLabels = generatePriorityAxisLabels(config);
    priorityLabels.forEach(({ position }) => {
      const { canvasX } = logicalToCanvas(position, 0, config);
      ctx.beginPath();
      ctx.moveTo(canvasX, config.marginY);
      ctx.lineTo(canvasX, config.canvasHeight - config.marginY);
      ctx.stroke();
    });
    
    // 水平网格线 (时间)
    const timeLabels = generateTimeAxisLabels(config);
    timeLabels.forEach(({ position }) => {
      const { canvasY } = logicalToCanvas(0, position, config);
      ctx.beginPath();
      ctx.moveTo(config.marginX, canvasY);
      ctx.lineTo(config.canvasWidth - config.marginX, canvasY);
      ctx.stroke();
    });
  }, [config]);

  // 获取点位颜色
  const getDotColor = React.useCallback((dot: CardDot, isHovered: boolean = false): string => {
    if (isHovered) return '#0f9960'; // 悬停时的绿色
    if (dot.isOverdue) return '#db3737'; // 过期 - 红色
    if (dot.isNew) return '#2b95d6'; // 新卡片 - 蓝色
    if (selectedDeck && dot.deckName === selectedDeck) return '#f29d49'; // 选中牌组 - 橙色
    return '#5c7080'; // 普通卡片 - 灰色
  }, [selectedDeck]);

  // 绘制点位
  const drawDots = React.useCallback((ctx: CanvasRenderingContext2D) => {
    dots.forEach(dot => {
      const { canvasX, canvasY } = logicalToCanvas(dot.x, dot.y, config);
      const isHovered = hoveredDot?.uid === dot.uid;
      const color = getDotColor(dot, isHovered);
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, isHovered ? config.dotSize + 2 : config.dotSize, 0, Math.PI * 2);
      ctx.fill();
      
      // 为过期卡片添加边框
      if (dot.isOverdue) {
        ctx.strokeStyle = '#a82a2a';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [dots, config, hoveredDot, getDotColor]);

  // 绘制背景（网格、轴、标签）
  const drawBackground = React.useCallback(() => {
    if (!backgroundCanvasRef.current) {
      backgroundCanvasRef.current = document.createElement('canvas');
      backgroundCanvasRef.current.width = config.canvasWidth;
      backgroundCanvasRef.current.height = config.canvasHeight;
    }
    
    const bgCtx = backgroundCanvasRef.current.getContext('2d');
    if (!bgCtx) return;
    
    // 清空背景画布
    bgCtx.clearRect(0, 0, config.canvasWidth, config.canvasHeight);
    
    // 绘制静态元素
    drawGrid(bgCtx);
    drawAxes(bgCtx);
    drawAxisLabels(bgCtx);
    
    setBackgroundNeedsUpdate(false);
  }, [config, drawGrid, drawAxes, drawAxisLabels]);

  // 主绘制函数
  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 清空画布
    ctx.clearRect(0, 0, config.canvasWidth, config.canvasHeight);
    
    // 绘制背景（如果需要更新）
    if (backgroundNeedsUpdate) {
      drawBackground();
    }
    
    // 复制背景到主画布
    if (backgroundCanvasRef.current) {
      ctx.drawImage(backgroundCanvasRef.current, 0, 0);
    }
    
    // 只绘制动态元素（点位）
    drawDots(ctx);
  }, [config, drawBackground, drawDots, backgroundNeedsUpdate]);

  // 查找点击的点位
  const findDotAtPosition = React.useCallback((x: number, y: number): CardDot | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;
    
    for (const dot of dots) {
      const { canvasX: dotX, canvasY: dotY } = logicalToCanvas(dot.x, dot.y, config);
      const distance = Math.sqrt((canvasX - dotX) ** 2 + (canvasY - dotY) ** 2);
      
      if (distance <= config.dotSize + 4) {
        return dot;
      }
    }
    
    return null;
  }, [dots, config]);

  // 处理鼠标事件
  const handleMouseMove = React.useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const dot = findDotAtPosition(event.clientX, event.clientY);
    setHoveredDot(dot);
    onDotHover?.(dot);
  }, [findDotAtPosition, onDotHover]);

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const dot = findDotAtPosition(event.clientX, event.clientY);
    if (dot) {
      onDotClick?.(dot);
    }
  }, [findDotAtPosition, onDotClick]);

  const handleMouseLeave = React.useCallback(() => {
    setHoveredDot(null);
    onDotHover?.(null);
  }, [onDotHover]);

  // 配置更改时更新背景
  React.useEffect(() => {
    setBackgroundNeedsUpdate(true);
  }, [config]);

  // 重新绘制 - 添加节流以提高性能
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      draw();
    }, 16); // 限制到60fps
    
    return () => clearTimeout(timeoutId);
  }, [draw]);

  return (
    <CanvasContainer>
      <StyledCanvas
        ref={canvasRef}
        width={config.canvasWidth}
        height={config.canvasHeight}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={handleMouseLeave}
      />
      {hoveredDot && (
        <Tooltip>
          <TooltipContent>
            <strong>{hoveredDot.deckName}</strong>
            <div>到期: {hoveredDot.daysToDue}天后</div>
            <div>优先级: {hoveredDot.priority.toFixed(1)}%</div>
            {hoveredDot.isNew && <div className="new-tag">新卡片</div>}
            {hoveredDot.isOverdue && <div className="overdue-tag">已过期</div>}
          </TooltipContent>
        </Tooltip>
      )}
    </CanvasContainer>
  );
};

const CanvasContainer = styled.div`
  position: relative;
  display: inline-block;
  border: 1px solid #e1e8ed;
  border-radius: 6px;
  background: white;
`;

const StyledCanvas = styled.canvas`
  display: block;
  cursor: crosshair;
  
  &:hover {
    cursor: pointer;
  }
`;

const Tooltip = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  pointer-events: none;
  z-index: 1000;
`;

const TooltipContent = styled.div`
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  
  .new-tag {
    color: #2b95d6;
    font-weight: 500;
  }
  
  .overdue-tag {
    color: #db3737;
    font-weight: 500;
  }
`;

export default CardDotMatrixCanvas;