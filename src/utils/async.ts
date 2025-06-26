export const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const debounce = (func, timeout = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
};

// 智能防抖：对于相同的键值，会取消之前的调用
export const smartDebounce = (func, timeout = 300) => {
  const timers = new Map();
  
  return (key, ...args) => {
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
    }
    
    const timer = setTimeout(() => {
      timers.delete(key);
      func.apply(this, args);
    }, timeout);
    
    timers.set(key, timer);
  };
};

// 可取消的Promise
export const cancellablePromise = (promise) => {
  let isCancelled = false;
  
  const wrappedPromise = new Promise((resolve, reject) => {
    promise.then(
      (result) => isCancelled ? reject(new Error('Cancelled')) : resolve(result),
      (error) => isCancelled ? reject(new Error('Cancelled')) : reject(error)
    );
  });
  
  return {
    promise: wrappedPromise,
    cancel: () => { isCancelled = true; }
  };
};

// 批量状态更新 - 使用原生的批处理机制
export const batchUpdate = (updateFunctions) => {
  // 在React 18中，状态更新默认是批处理的
  // 对于旧版本，我们可以使用 unstable_batchedUpdates
  if (typeof window !== 'undefined' && window.React && window.React.unstable_batchedUpdates) {
    window.React.unstable_batchedUpdates(() => {
      updateFunctions.forEach(fn => fn());
    });
  } else {
    // 现代React会自动批处理这些更新
    updateFunctions.forEach(fn => fn());
  }
};
