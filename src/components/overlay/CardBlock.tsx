import * as React from 'react';
import { Breadcrumbs as BreadcrumbsType } from '~/queries';
import styled from '@emotion/styled';
import * as domUtils from '~/utils/dom';
import * as asyncUtils from '~/utils/async';
import { Icon } from '@blueprintjs/core';
import useCloze from '~/hooks/useCloze';

const CardBlock = ({
  refUid,
  showAnswers,
  setHasCloze,
  breadcrumbs,
  showBreadcrumbs,
}: {
  refUid: string;
  showAnswers: boolean;
  setHasCloze: (hasCloze: boolean) => void;
  breadcrumbs: BreadcrumbsType[];
  showBreadcrumbs: boolean;
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [renderedBlockElm, setRenderedBlockElm] = React.useState<HTMLElement | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  useCloze({ renderedBlockElm: renderedBlockElm as HTMLElement, hasClozeCallback: setHasCloze });

  const [forceUpdate, setForceUpdate] = React.useState(0);

  // Store the current refUid in a ref to access it inside the debounced function
  const refUidRef = React.useRef(refUid);

  // Create a ref for the mutation observer
  const observerRef = React.useRef<MutationObserver | null>(null);

  // Update the ref when refUid changes
  React.useEffect(() => {
    refUidRef.current = refUid;
  }, [refUid]);

  // Create a ref to store the debounced function
  const debouncedFnRef = React.useRef<(() => void) | null>(null);

  const handleBlockBlur = React.useCallback(() => {
    setForceUpdate((prev) => {
      return prev + 1;
    });
  }, []);

  // Set up the debounced function only once when the component mounts
  React.useEffect(() => {
    // Define the function to be debounced
    const renderBlock = async () => {
      const currentRefUid = refUidRef.current;
      if (!ref.current) return;

      setIsLoading(true);

      try {
        await window.roamAlphaAPI.ui.components.unmountNode({ el: ref.current });
        await window.roamAlphaAPI.ui.components.renderBlock({ uid: currentRefUid, el: ref.current });

        // Ensure block is not collapsed (so we can reveal children programatically)
        const roamBlockElm = ref.current.querySelector('.rm-block') as HTMLElement | null;
        setRenderedBlockElm(roamBlockElm);
        const isCollapsed = roamBlockElm?.classList.contains('rm-block--closed');
        if (isCollapsed) {
          // Currently no Roam API to toggle block collapse, so had to find this hacky
          // way to do it by simulating click
          const expandControlBtn = ref.current.querySelector('.block-expand .rm-caret');

          domUtils.simulateMouseClick(expandControlBtn);
          await asyncUtils.sleep(50); // 减少延迟从100ms到50ms
          domUtils.simulateMouseClick(expandControlBtn);
        }

        // Disconnect any existing observer
        if (observerRef.current) {
          observerRef.current.disconnect();
        }

        // Add a mutation observer to detect dynamically added textareas (so we can add blur listeners)
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              mutation.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) {
                  const newTextareas = node.querySelectorAll('textarea');
                  if (newTextareas.length > 0) {
                    newTextareas.forEach((textarea) => {
                      textarea.removeEventListener('blur', handleBlockBlur);
                      textarea.addEventListener('blur', handleBlockBlur);
                    });
                  }
                }
              });
            }
          });
        });

        observer.observe(ref.current, { childList: true, subtree: true });
        observerRef.current = observer;
      } finally {
        setIsLoading(false);
      }
    };

    // Create the smart debounced function with reduced timeout from 100ms to 50ms
    const smartDebouncedRender = asyncUtils.smartDebounce(renderBlock, 50);
    debouncedFnRef.current = () => smartDebouncedRender(refUidRef.current);

    // Clean up function
    return () => {
      debouncedFnRef.current = null;

      // Disconnect the mutation observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [handleBlockBlur]);

  // Call the debounced function when refUid changes
  React.useEffect(() => {
    if (debouncedFnRef.current) {
      debouncedFnRef.current();
    }
  }, [refUid, forceUpdate]);

  return (
    <div>
      {breadcrumbs && showBreadcrumbs && <Breadcrumbs breadcrumbs={breadcrumbs} />}
      {isLoading && <LoadingOverlay>加载中...</LoadingOverlay>}
      <ContentWrapper ref={ref} showAnswers={showAnswers} isLoading={isLoading}></ContentWrapper>
    </div>
  );
};

const LoadingOverlay = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  background: rgba(255, 255, 255, 0.9);
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  color: #666;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ContentWrapper = styled.div<{
  showAnswers: boolean;
  isLoading?: boolean;
}>`
  // To align bullet on the left + ref count on the right correctly
  position: relative;
  left: -14px;
  width: calc(100% + 19px);
  opacity: ${(props) => props.isLoading ? 0.5 : 1};
  transition: opacity 0.2s ease-in-out;

  & .rm-block-children {
    /* 🚀 FLASH FIX V3: 使用 visibility + opacity 代替 display，避免闪烁 */
    visibility: ${(props) => (props.showAnswers ? 'visible' : 'hidden')};
    opacity: ${(props) => (props.showAnswers ? 1 : 0)};
    height: ${(props) => (props.showAnswers ? 'auto' : '0')};
    overflow: ${(props) => (props.showAnswers ? 'visible' : 'hidden')};
    transition: opacity 0.15s ease-in-out, height 0.15s ease-in-out;
    display: flex; /* 保持 flex 布局，不改变 display */
  }

  & .rm-block-separator {
    min-width: unset; // Keeping roam block from expanding 100
  }

  & .rm-highlight,
  .roam-memo-cloze {
    background-color: ${(props) => (props.showAnswers ? 'transparent' : '#e1e3e5')};
    color: ${(props) => (props.showAnswers ? 'inherit' : 'transparent')};
    overflow: hidden;
    border-radius: 2px;
    padding: 0;
    margin: 0;
    /* 🚀 FLASH FIX V3: 添加平滑过渡效果 */
    transition: background-color 0.15s ease-in-out, color 0.15s ease-in-out;
  }
`;

const Breadcrumbs = ({ breadcrumbs }) => {
  const items = breadcrumbs.map((breadcrumb, index) => ({
    current: index === breadcrumbs.length - 1,
    text: breadcrumb.title || breadcrumb.string, // root pages have title but no string
  }));
  return (
    <BreadCrumbWrapper className="rm-zoom zoom-path-view">
      {items.map((item, i) => (
        <div key={i} className="rm-zoom-item">
          <span className="rm-zoom-item-content">{item.text}</span>{' '}
          {i !== items.length - 1 && <Icon icon="chevron-right" />}
        </div>
      ))}
    </BreadCrumbWrapper>
  );
};

const BreadCrumbWrapper = styled.div`
  opacity: 0.7;
  margin-left: 8px !important;
  margin-top: -4px !important;

  &.rm-zoom-item {
    cursor: auto !important;
  }
`;

export default CardBlock;
