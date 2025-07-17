import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import styled from '@emotion/styled';
import mediaQueries from '~/utils/mediaQueries';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const UnifiedDialog = ({ isOpen, onClose, children, className }: Props) => {
  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose} 
      className={`pb-0 bg-white ${className || ''}`}
      canEscapeKeyClose={false}
    >
      {children}
    </Dialog>
  );
};

const Dialog = styled(Blueprint.Dialog)`
  max-height: 80vh;
  width: 90vw;

  ${mediaQueries.lg} {
    width: 80vw;
  }

  ${mediaQueries.xl} {
    width: 70vw;
  }

  /* 📱 Mobile portrait: full-screen vertical layout */
  ${mediaQueries.mobilePortrait} {
    width: 100vw;
    height: 100vh;
    max-height: 100vh;
    margin: 0;
    border-radius: 0;
  }

  /* 确保内容背景是白色并移除默认内边距 */
  .bp3-dialog {
    background: white !important;
    padding: 0 !important;
    margin: 0 !important;
  }
`;

export default UnifiedDialog;