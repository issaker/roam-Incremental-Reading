import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';

interface OffsetSliderProps {
  initialPriority: number;
  onPriorityChange: (newPriority: number) => void;
}

const OffsetSlider = ({ initialPriority, onPriorityChange }: OffsetSliderProps) => {
  const [offsetValue, setOffsetValue] = React.useState(0);

  const handleOffsetChange = (newOffsetValue: number) => {
    // 输入验证：确保偏移值在合理范围内
    const clampedOffset = Math.max(-100, Math.min(100, newOffsetValue));
    setOffsetValue(clampedOffset);
    const newPriority = Math.max(0, Math.min(100, initialPriority + clampedOffset));
    onPriorityChange(newPriority);
  };

  return (
    <SliderContainer>
      <Blueprint.Slider
        min={-100}
        max={100}
        stepSize={1}
        labelStepSize={50}
        value={offsetValue}
        onChange={handleOffsetChange}
        labelRenderer={(val) => `${val >= 0 ? '+' : ''}${val}`}
      />
      <OffsetLabel>偏移: {offsetValue >= 0 ? '+' : ''}{offsetValue} 点</OffsetLabel>
      <PriorityPreview>目标优先级: {Math.max(0, Math.min(100, initialPriority + offsetValue))}%</PriorityPreview>
    </SliderContainer>
  );
};

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 180px;
  gap: 4px;
`;

const OffsetLabel = styled.div`
  font-size: 12px;
  color: #5c7080;
  text-align: center;
`;

const PriorityPreview = styled.div`
  font-size: 11px;
  color: #106ba3;
  text-align: center;
  font-weight: 500;
`;

export default OffsetSlider; 