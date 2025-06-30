import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';

interface OffsetSliderProps {
  initialPriority: number;
  onPriorityChange: (newPriority: number) => void;
}

const OffsetSlider = ({ initialPriority, onPriorityChange }: OffsetSliderProps) => {
  const [offset, setOffset] = React.useState(0);

  const handleOffsetChange = (newOffset: number) => {
    setOffset(newOffset);
    const newPriority = Math.round(initialPriority * (1 + newOffset / 100));
    onPriorityChange(Math.max(0, Math.min(100, newPriority)));
  };

  return (
    <SliderContainer>
      <Blueprint.Slider
        min={-50}
        max={50}
        stepSize={1}
        labelStepSize={25}
        value={offset}
        onChange={handleOffsetChange}
        labelRenderer={(val) => `${val}%`}
      />
      <OffsetLabel>偏移: {offset >= 0 ? '+' : ''}{offset}%</OffsetLabel>
    </SliderContainer>
  );
};

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 150px;
  gap: 4px;
`;

const OffsetLabel = styled.div`
  font-size: 12px;
  color: #5c7080;
  text-align: center;
`;

export default OffsetSlider; 