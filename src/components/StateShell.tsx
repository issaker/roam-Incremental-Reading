import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';

type StateType = 'loading' | 'saving';

interface Props {
  state: StateType;
  onClose: () => void;
  showForceClose?: boolean;
}

const StateShell = ({ state, onClose, showForceClose = false }: Props) => {
  const config = {
    loading: {
      text: '正在准备复习...',
      buttonTitle: 'Close'
    },
    saving: {
      text: '正在保存进度...',
      buttonTitle: '强制关闭'
    }
  };

  const currentConfig = config[state];

  return (
    <StateContainer>
      <DialogHeader>
        <span>Roam Memo</span>
        <CloseButton
          icon="cross"
          minimal
          onClick={onClose}
          title={currentConfig.buttonTitle}
          showForceClose={showForceClose}
        />
      </DialogHeader>
      
      <DialogBody className="bp3-dialog-body overflow-y-scroll m-0 pt-6 pb-8 px-4">
        <StateContent>
          <Blueprint.Spinner intent="primary" size={40} />
          <StateText>{currentConfig.text}</StateText>
        </StateContent>
      </DialogBody>
    </StateContainer>
  );
};

const DialogHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #5c7080;
  background-color: #f6f9fd;
  box-shadow: 0 1px 0 rgb(16 22 26 / 10%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-wrap: normal;
  line-height: inherit;
  margin: 0;
  min-height: 50px;
  padding: 0 16px;
  font-weight: 500;
`;

const DialogBody = styled.div`
  overflow-x: hidden;
  min-height: 200px;
`;

const StateContainer = styled.div`
  display: grid;
  grid-template-rows: 50px 1fr;
  height: 100%;
  width: 100%;
`;

const StateContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem;
`;

const StateText = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: #5c7080;
`;

const CloseButton = styled(Blueprint.Button)<{ showForceClose?: boolean }>`
  opacity: ${props => props.showForceClose ? 0.6 : 1};
  
  &:hover {
    opacity: 1;
  }
`;

export default StateShell;