import ReactDOM from 'react-dom';
import App from './app';
import { FocusStyleManager } from '@blueprintjs/core';


const container_id: string = 'roam-memo-wrapper';

const createAndRenderContainer = () => {
  // 🛡️ 防重复插入：若容器已存在则复用
  const existingContainers = document.querySelectorAll(`#${container_id}`);
  if (existingContainers.length > 0) {
    // 移除除第一个外的其他重复容器，确保 DOM 结构唯一
    existingContainers.forEach((node, idx) => {
      if (idx > 0 && node.parentNode) {
        node.parentNode.removeChild(node);
      }
    });
    return existingContainers[0] as HTMLElement;
  }
  // @TODO: This is where I want it personally, but maybe make this a configurable setting?
  const siblingElm = document.querySelector('.rm-left-sidebar__daily-notes');
  const newContainerElm = document.createElement('div');
  newContainerElm.id = container_id;
  newContainerElm.classList.add('log-button'); // match style
  
  if (siblingElm && siblingElm.parentNode) {
    siblingElm.parentNode.insertBefore(newContainerElm, siblingElm.nextSibling);
  } else {
    // 如果找不到预期位置，添加到body
    document.body.appendChild(newContainerElm);
  }

  return newContainerElm;
};
function onload({ extensionAPI }) {
  // This just makes life easier (instead of having to pipe it down everywhere I
  // want to dynamically fetch the latest config)
  window.roamMemo = {
    extensionAPI,
  };

  FocusStyleManager.onlyShowFocusOnTabs();

  const container = createAndRenderContainer();
  ReactDOM.render(<App />, container);

}

function onunload() {
  const container = document.getElementById(container_id);

  // 直接导入并清理焦点管理器，确保移除所有事件监听器
  try {
    const { roamFocusManager } = require('./utils/roamFocusManager');
    roamFocusManager.forceCleanup();
  } catch (error) {
          console.error('🎯 Memo Enhanced: 清理焦点管理器失败:', error);
  }

  // 直接导入并清理层级管理器，移除注入的CSS样式
  try {
    const { roamZIndexManager } = require('./utils/roamZIndexManager');
    roamZIndexManager.removeZIndexFix();
  } catch (error) {
          console.error('🔧 Memo Enhanced: 清理层级管理器失败:', error);
  }

  if (container) {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  }

}

export default {
  onload: onload,
  onunload: onunload,
};
