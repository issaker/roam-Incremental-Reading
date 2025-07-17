import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';

interface Props {
  currentPosition: number;
  totalCards: number;
  onPositionChange: (newPosition: number) => void;
  disabled?: boolean;
}

const PrioritySlider = ({ 
  currentPosition, 
  totalCards, 
  onPositionChange, 
  disabled = false 
}: Props) => {
  const [localValue, setLocalValue] = React.useState(currentPosition);
  
  React.useEffect(() => {
    setLocalValue(currentPosition);
  }, [currentPosition]);

  const handleSliderChange = (value: number) => {
    setLocalValue(value);
  };

  const handleSliderRelease = (value: number) => {
    onPositionChange(value);
  };

  const priority = Math.round(((totalCards - currentPosition + 1) / totalCards) * 100);

  return (
    <Container>
      <Header>
        <Title>卡片优先级</Title>
        <Info>
          位置: {currentPosition}/{totalCards} | 优先级: {priority}%
        </Info>
      </Header>
      
      <SliderContainer>
        <Blueprint.Slider
          min={1}
          max={totalCards}
          stepSize={1}
          value={localValue}
          onChange={handleSliderChange}
          onRelease={handleSliderRelease}
          disabled={disabled}
          labelRenderer={(value) => `${value}`}
          labelStepSize={Math.max(1, Math.floor(totalCards / 5))}
        />
      </SliderContainer>
      
      <Controls>
        <Blueprint.Button
          icon="chevron-up"
          minimal
          small
          disabled={disabled || currentPosition <= 1}
          onClick={() => onPositionChange(Math.max(1, currentPosition - 1))}
          title="提高优先级"
        />
        <Blueprint.Button
          icon="chevron-down"
          minimal
          small
          disabled={disabled || currentPosition >= totalCards}
          onClick={() => onPositionChange(Math.min(totalCards, currentPosition + 1))}
          title="降低优先级"
        />
      </Controls>
    </Container>
  );
};

const Container = styled.div`
  padding: 12px 16px;
  background: #f5f8fa;
  border-top: 1px solid #e1e8ed;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const Title = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: #182026;
`;

const Info = styled.span`
  font-size: 12px;
  color: #5c7080;
`;

const SliderContainer = styled.div`
  margin: 0 8px 12px 8px;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  gap: 8px;
`;

export default PrioritySlider;