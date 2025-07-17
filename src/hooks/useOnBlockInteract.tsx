import React from 'react';
import Arrive from 'arrive';

Arrive; // To prevent tree shaking elimination

const useOnBlockInteract = ({
  onEnterCallback,
  onLeaveCallback,
  enabled = true,
}: {
  onEnterCallback: (elm: HTMLTextAreaElement) => void;
  onLeaveCallback: (elm: HTMLTextAreaElement) => void;
  enabled?: boolean;
}) => {
  React.useEffect(() => {
    if (!enabled) {
      // 如果未启用，确保清理现有监听器
      document.unbindLeave('textarea.rm-block-input', onLeaveCallback);
      document.unbindArrive('textarea.rm-block-input', onEnterCallback);
      return;
    }

    document.leave('textarea.rm-block-input', onLeaveCallback);
    document.arrive('textarea.rm-block-input', onEnterCallback);

    return () => {
      document.unbindLeave('textarea.rm-block-input', onLeaveCallback);
      document.unbindArrive('textarea.rm-block-input', onEnterCallback);
    };
  }, [onEnterCallback, onLeaveCallback, enabled]);
};

export default useOnBlockInteract;
