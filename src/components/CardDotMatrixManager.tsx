import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import * as BlueprintSelect from '@blueprintjs/select';
import styled from '@emotion/styled';
import CardDotMatrixCanvas from './CardDotMatrixCanvas';
import { Box, Stack } from './layout';
import { 
  CardDot, 
  DotMatrixConfig, 
  defaultDotMatrixConfig,
  generateDotMatrixData,
  filterDotsByDeck,
  applyDeckTransform 
} from '~/utils/CardDotMatrix';
import { CompleteRecords, RecordUid } from '~/models/session';
import { Today } from '~/models/practice';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  practiceData: CompleteRecords;
  cardUids: Record<string, RecordUid[]>;
  priorityOrder: RecordUid[];
  today: Today;
  tagsList: string[];
  selectedTag?: string;
  onTagSelect?: (tag: string) => void;
  onPriorityUpdate?: (newPriorityOrder: RecordUid[]) => Promise<void>;
}

const CardDotMatrixManager: React.FC<Props> = ({
  isOpen,
  onClose,
  practiceData,
  cardUids,
  priorityOrder,
  today,
  tagsList,
  selectedTag,
  onTagSelect,
  onPriorityUpdate
}) => {
  const [config, setConfig] = React.useState<DotMatrixConfig>(defaultDotMatrixConfig);
  const [selectedDeck, setSelectedDeck] = React.useState<string>('');
  const [xOffset, setXOffset] = React.useState<number>(0);
  const [xScale, setXScale] = React.useState<number>(1);
  const [hoveredDot, setHoveredDot] = React.useState<CardDot | null>(null);

  // 生成所有点阵数据
  const allDots = React.useMemo(() => {
    return generateDotMatrixData(practiceData, cardUids, priorityOrder, today, config);
  }, [practiceData, cardUids, priorityOrder, today, config]);

  // 根据选中的牌组筛选点位
  const filteredDots = React.useMemo(() => {
    if (!selectedDeck) return allDots;
    const deckDots = filterDotsByDeck(allDots, selectedDeck);
    return applyDeckTransform(deckDots, xOffset, xScale);
  }, [allDots, selectedDeck, xOffset, xScale]);

  // 统计信息
  const stats = React.useMemo(() => {
    const total = filteredDots.length;
    const overdue = filteredDots.filter(dot => dot.isOverdue).length;
    const newCards = filteredDots.filter(dot => dot.isNew).length;
    const regular = total - overdue - newCards;
    
    return { total, overdue, newCards, regular };
  }, [filteredDots]);

  // 重置变换
  const resetTransform = () => {
    setXOffset(0);
    setXScale(1);
  };

  // 应用变换到全局队列 - 直接偏移每张卡片
  const applyTransform = async () => {
    if (!selectedDeck || (xOffset === 0 && xScale === 1)) return;
    
    try {
      // 获取当前牌组的卡片
      const deckUids = cardUids[selectedDeck] || [];
      if (deckUids.length === 0) {
        return;
      }
      
      // 直接偏移算法：为每张卡片计算新位置
      const newOrder = [...priorityOrder];
      const totalCards = newOrder.length;
      
      // 找到牌组中所有卡片的当前位置
      const deckCardInfos = deckUids
        .map(uid => ({
          uid,
          oldIndex: newOrder.indexOf(uid)
        }))
        .filter(info => info.oldIndex !== -1)
        .sort((a, b) => a.oldIndex - b.oldIndex); // 按位置排序
      
      if (deckCardInfos.length === 0) {
        return;
      }
      
      // 计算牌组中心位置和偏移量
      const deckCenterIndex = (deckCardInfos[0].oldIndex + deckCardInfos[deckCardInfos.length - 1].oldIndex) / 2;
      const currentPriority = ((totalCards - deckCenterIndex) / totalCards) * 100;
      const newPriority = Math.max(0, Math.min(100, currentPriority + xOffset));
      const targetCenterIndex = ((100 - newPriority) / 100) * totalCards;
      const centerOffset = targetCenterIndex - deckCenterIndex;
      
      // 简化算法 - 依靠数组自然挤出效果
      const originalSpan = deckCardInfos[deckCardInfos.length - 1].oldIndex - deckCardInfos[0].oldIndex;
      const targetSpan = originalSpan * xScale;
      
      // 第一步：批量移除所有牌组卡片
      const deckCards = deckCardInfos.map(info => info.uid);
      
      // 从后往前移除，避免索引变化
      const sortedPositions = deckCardInfos
        .map(info => info.oldIndex)
        .sort((a, b) => b - a); // 从大到小排序
      
      for (const position of sortedPositions) {
        newOrder.splice(position, 1);
      }
      
      // 第二步：为每张卡片计算目标位置（允许重叠）
      const moves = deckCardInfos.map((cardInfo, index) => {
        // 计算在牌组内的相对位置 (0 到 1)
        const relativePosition = deckCardInfos.length > 1 ? index / (deckCardInfos.length - 1) : 0.5;
        
        // 映射到目标跨度内的具体位置
        const positionInSpan = (relativePosition - 0.5) * targetSpan;
        const rawTargetPos = targetCenterIndex + positionInSpan;
        
        // 边界检查（注意：现在数组长度变了）
        const currentArrayLength = newOrder.length;
        const targetPos = Math.max(0, Math.min(currentArrayLength, Math.round(rawTargetPos)));
        
        return {
          card: cardInfo.uid,
          targetPos: targetPos
        };
      });
      
      // 第三步：按目标位置排序后依次插入（自动挤出）
      moves.sort((a, b) => a.targetPos - b.targetPos);
      
      moves.forEach((move) => {
        newOrder.splice(move.targetPos, 0, move.card);
      });
      
      
      // 调用保存函数
      if (onPriorityUpdate) {
        await onPriorityUpdate(newOrder);
      }
      
      // 重置变换
      resetTransform();
      
    } catch (error) {
      console.error('❌ 应用变换失败:', error);
    }
  };

  // 处理牌组选择
  const handleDeckSelect = (deckName: string) => {
    setSelectedDeck(deckName);
    resetTransform();
  };

  // 处理点位点击
  const handleDotClick = (dot: CardDot) => {
    // 这里可以添加跳转到卡片详情的逻辑
  };

  // 处理点位悬停
  const handleDotHover = (dot: CardDot | null) => {
    setHoveredDot(dot);
  };

  return (
    <Blueprint.Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="卡片排期点阵图"
      style={{ width: '960px', maxHeight: '95vh', overflow: 'auto' }}
    >
      <DialogContent className="bp3-dialog-body">
        <Stack
          direction="row"
          align="flex-end"
          gap={24}
          p="12px"
          bg="#ffffff"
          borderRadius="6px"
          border="1px solid #e1e8ed"
          flexWrap="wrap"
        >
          <Stack direction="column" gap={4} flex="1 1 200px" minWidth="200px">
            <Blueprint.Label>牌组选择</Blueprint.Label>
            <DeckSelect>
              <DeckSelector
                tagsList={tagsList}
                selectedTag={selectedDeck}
                cardUids={cardUids}
                onTagChange={handleDeckSelect}
              />
            </DeckSelect>
          </Stack>

          <Stack direction="column" gap={4} flex="1 1 150px" minWidth="150px">
            <Blueprint.Label>
              X轴偏移
              <ValueDisplay>{xOffset > 0 ? '+' : ''}{xOffset}</ValueDisplay>
            </Blueprint.Label>
            <Blueprint.Slider
              min={-50}
              max={50}
              stepSize={1}
              value={xOffset}
              onChange={setXOffset}
              labelStepSize={25}
              disabled={!selectedDeck}
              showTrackFill={false}
            />
          </Stack>

          <Stack direction="column" gap={4} flex="1 1 150px" minWidth="150px">
            <Blueprint.Label>
              X轴缩放
              <ValueDisplay>×{xScale.toFixed(1)}</ValueDisplay>
            </Blueprint.Label>
            <Blueprint.Slider
              min={0.1}
              max={3}
              stepSize={0.1}
              value={xScale}
              onChange={setXScale}
              labelStepSize={1}
              disabled={!selectedDeck}
              showTrackFill={false}
            />
          </Stack>

          <Stack direction="row" gap={8} align="center" flexShrink={0} mt="auto" pb="4px">
            <Blueprint.Button
              text="重置变换"
              onClick={resetTransform}
              disabled={!selectedDeck}
            />
            <Blueprint.Button
              text="应用变换"
              intent="primary"
              onClick={applyTransform}
              disabled={!selectedDeck || (xOffset === 0 && xScale === 1)}
            />
          </Stack>
        </Stack>

        <ChartSection>
          <MatrixContainer>
            <CardDotMatrixCanvas
              dots={filteredDots}
              config={config}
              selectedDeck={selectedDeck}
              onDotClick={handleDotClick}
              onDotHover={handleDotHover}
            />
            <AxisLabel>优先级</AxisLabel>
          </MatrixContainer>
        </ChartSection>

        <Stack 
          direction="row" 
          justify="space-around" 
          align="stretch" 
          gap={12} 
          p="12px"
          bg="#ffffff"
          borderRadius="6px"
          border="1px solid #e1e8ed"
          mt="8px"
        >
          <StatItem>
            <StatLabel>总卡片数</StatLabel>
            <StatValue>{stats.total}</StatValue>
          </StatItem>
          <StatItem overdue={true}>
            <StatLabel>过期卡片</StatLabel>
            <StatValue>{stats.overdue}</StatValue>
          </StatItem>
          <StatItem newCard={true}>
            <StatLabel>新卡片</StatLabel>
            <StatValue>{stats.newCards}</StatValue>
          </StatItem>
          <StatItem>
            <StatLabel>正常卡片</StatLabel>
            <StatValue>{stats.regular}</StatValue>
          </StatItem>
        </Stack>
      </DialogContent>
      
      <div className="bp3-dialog-footer">
        <div className="bp3-dialog-footer-actions">
          <Blueprint.Button onClick={onClose}>关闭</Blueprint.Button>
        </div>
      </div>
    </Blueprint.Dialog>
  );
};

const DialogContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  box-sizing: border-box;
  flex: 1 1 auto;
  overflow-y: auto;
  background-color: #f0f4f8;
`;

const ChartSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: #f8fafb;
  border-radius: 6px;
  border: 1px solid #e1e8ed;
  min-height: 480px;
`;

const MatrixContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e1e8ed;
  box-shadow: 0 1px 2px rgba(16, 22, 26, 0.05);
  width: 100%;
  max-width: 840px;
`;

// Keep specific, non-layout styles. Remove all layout-related styled-components.
const DeckSelect = styled.div`
  min-width: 200px;
  max-width: 280px;
  
  .bp3-button {
    text-overflow: ellipsis;
    white-space: nowrap;
    height: 30px;
    padding: 0 10px;
  }
  
  .deck-selector-popover .bp3-popover-content {
    max-height: 300px;
    overflow-y: auto;
  }
`;

const AxisLabel = styled.span`
  font-size: 12px;
  color: #8a9ba8;
  font-weight: 500;
  text-align: center;
  margin-top: 4px;
  padding: 2px 8px;
`;

const StatItem = styled.div<{ overdue?: boolean; newCard?: boolean }>`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 4px;
  background: #f8fafc;
  border: 1px solid #eaf0f6;
  min-width: 75px;
  flex: 1;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(16, 22, 26, 0.1);
  }
  
  ${(props) => props.overdue && `
    border-color: #db3737;
    background: #fff5f5;
  `}
  
  ${(props) => props.newCard && `
    border-color: #2b95d6;
    background: #f5f9fc;
  `}
`;

const StatLabel = styled.span`
  font-size: 11px;
  color: #5c7080;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
`;

const StatValue = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: #182026;
  line-height: 1.1;
`;

const ValueDisplay = styled.span`
  font-weight: 600;
  color: #2b95d6;
  margin-left: 8px;
  font-size: 13px;
  background: rgba(43, 149, 214, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
`;

// DeckSelector and DeckSelectorItem components remain the same
// 牌组选择器组件，支持搜索功能
const DeckSelector: React.FC<{
  tagsList: string[];
  selectedTag: string;
  cardUids: Record<string, string[]>;
  onTagChange: (tag: string) => void;
}> = ({ tagsList, selectedTag, cardUids, onTagChange }) => {
  // 自定义过滤函数，支持中文和英文搜索
  const filterTag = (query: string, tag: string) => {
    const normalizedQuery = query.toLowerCase();
    const normalizedTag = tag.toLowerCase();
    return normalizedTag.includes(normalizedQuery);
  };

  // 扩展的选项列表，包含“显示所有牌组”选项
  const allOptions = ['', ...tagsList];

  return (
    // @ts-ignore
    <BlueprintSelect.Select
      items={allOptions}
      activeItem={selectedTag}
      filterable={true}
      itemPredicate={(query, item) => {
        if (item === '') {
          return '显示所有牌组'.includes(query.toLowerCase()) || query === '';
        }
        return filterTag(query, item);
      }}
      inputProps={{ placeholder: "搜索牌组..." }}
      itemRenderer={(tag, { handleClick, modifiers, query }) => {
        const displayText = tag === '' ? '显示所有牌组' : `${tag} (${cardUids[tag]?.length || 0}张)`;
        
        if (tag === '') {
          return (
            <DeckSelectorItem
              key="all-decks"
              active={modifiers.active}
              onClick={handleClick}
            >
              <span style={{ fontStyle: 'italic', color: '#5c7080' }}>
                显示所有牌组
              </span>
            </DeckSelectorItem>
          );
        }

        // 高亮匹配的部分
        if (query) {
          const index = tag.toLowerCase().indexOf(query.toLowerCase());
          if (index >= 0) {
            const before = tag.substring(0, index);
            const match = tag.substring(index, index + query.length);
            const after = tag.substring(index + query.length);
            
            return (
              <DeckSelectorItem
                key={tag}
                active={modifiers.active}
                onClick={handleClick}
              >
                <span>
                  {before}
                  <strong style={{ color: '#106ba3' }}>{match}</strong>
                  {after}
                </span>
                <span style={{ color: '#5c7080', fontSize: '12px', marginLeft: '8px' }}>
                  ({cardUids[tag]?.length || 0}张)
                </span>
              </DeckSelectorItem>
            );
          }
        }
        
        return (
          <DeckSelectorItem
            key={tag}
            active={modifiers.active}
            onClick={handleClick}
          >
            <span>{tag}</span>
            <span style={{ color: '#5c7080', fontSize: '12px', marginLeft: '8px' }}>
              ({cardUids[tag]?.length || 0}张)
            </span>
          </DeckSelectorItem>
        );
      }}
      onItemSelect={onTagChange}
      popoverProps={{
        minimal: true,
        fill: true,
        popoverClassName: 'deck-selector-popover'
      }}
    >
      <Blueprint.Button
        text={selectedTag === '' ? '显示所有牌组' : `${selectedTag} (${cardUids[selectedTag]?.length || 0}张)`}
        rightIcon="caret-down"
        fill
        style={{ 
          justifyContent: 'space-between',
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      />
    </BlueprintSelect.Select>
  );
};

// 牌组选择项样式
const DeckSelectorItem = styled.div<{ active: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  min-height: 30px;
  
  ${props => props.active && `
    background-color: #137cbd;
    color: white;
    
    span {
      color: white !important;
    }
    
    strong {
      color: #ffd700 !important;
    }
  `}
  
  &:hover {
    background-color: ${props => props.active ? '#137cbd' : '#f5f8fa'};
  }
`;

export default CardDotMatrixManager;