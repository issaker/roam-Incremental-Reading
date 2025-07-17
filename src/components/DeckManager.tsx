import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';

interface DeckInfo {
  deckName: string;
  position: number;
  cardCount: number;
}

interface Props {
  deckPositions: DeckInfo[];
  selectedDeck?: string;
  isOpen: boolean;
  onClose: () => void;
  onMoveDeck: (deckName: string, direction: 'up' | 'down') => Promise<void>;
  isLoading?: boolean;
}

const DeckManager = ({
  deckPositions,
  selectedDeck,
  isOpen,
  onClose,
  onMoveDeck,
  isLoading = false
}: Props) => {
  const [movingDeck, setMovingDeck] = React.useState<string | null>(null);

  const handleMoveDeck = async (deckName: string, direction: 'up' | 'down') => {
    if (movingDeck) return;
    
    setMovingDeck(deckName);
    try {
      await onMoveDeck(deckName, direction);
    } catch (error) {
      console.error('移动牌组失败:', error);
    } finally {
      setMovingDeck(null);
    }
  };

  return (
    <Blueprint.Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="牌组顺序管理"
      style={{ width: '500px' }}
    >
      <DialogContent className="bp3-dialog-body">
        {isLoading ? (
          <LoadingContainer>
            <Blueprint.Spinner size={30} />
            <span>加载中...</span>
          </LoadingContainer>
        ) : deckPositions.length === 0 ? (
          <EmptyState>
            <Blueprint.Icon icon="folder-open" size={40} />
            <p>暂无牌组数据</p>
          </EmptyState>
        ) : (
          <DeckList>
            {deckPositions.map((deck, index) => (
              <DeckItem 
                key={deck.deckName} 
                isSelected={selectedDeck === deck.deckName}
                isMoving={movingDeck === deck.deckName}
              >
                <DeckInfo>
                  <DeckRank>#{index + 1}</DeckRank>
                  <DeckName>{deck.deckName}</DeckName>
                  <CardCount>{deck.cardCount} 张卡片</CardCount>
                </DeckInfo>
                
                <DeckControls>
                  <Blueprint.Button
                    icon="chevron-up"
                    minimal
                    disabled={index === 0 || movingDeck !== null}
                    loading={movingDeck === deck.deckName}
                    onClick={() => handleMoveDeck(deck.deckName, 'up')}
                    title="提高优先级"
                  />
                  <Blueprint.Button
                    icon="chevron-down"
                    minimal
                    disabled={index === deckPositions.length - 1 || movingDeck !== null}
                    loading={movingDeck === deck.deckName}
                    onClick={() => handleMoveDeck(deck.deckName, 'down')}
                    title="降低优先级"
                  />
                </DeckControls>
              </DeckItem>
            ))}
          </DeckList>
        )}
      </DialogContent>
      
      <div className="bp3-dialog-footer">
        <div className="bp3-dialog-footer-actions">
          <Blueprint.Button onClick={onClose}>
            关闭
          </Blueprint.Button>
        </div>
      </div>
    </Blueprint.Dialog>
  );
};

const DialogContent = styled.div`
  min-height: 200px;
  max-height: 600px;
  overflow-y: auto;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  color: #5c7080;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px;
  color: #5c7080;
  
  .bp3-icon {
    color: #a7b6c2;
  }
`;

const DeckList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DeckItem = styled.div<{ isSelected: boolean; isMoving: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #e1e8ed;
  background-color: ${props => props.isSelected ? '#f5f8fa' : 'white'};
  opacity: ${props => props.isMoving ? 0.6 : 1};
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #f5f8fa;
  }
`;

const DeckInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

const DeckRank = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #5c7080;
  width: 30px;
`;

const DeckName = styled.span`
  font-weight: 500;
  color: #182026;
  flex: 1;
`;

const CardCount = styled.span`
  font-size: 12px;
  color: #5c7080;
  padding: 2px 8px;
  background-color: #e1e8ed;
  border-radius: 3px;
`;

const DeckControls = styled.div`
  display: flex;
  gap: 4px;
`;

export default DeckManager;