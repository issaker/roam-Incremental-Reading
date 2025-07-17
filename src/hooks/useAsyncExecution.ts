import * as React from 'react';

interface UseAsyncExecutionOptions<T> {
  onError?: (error: Error) => void;
  onSuccess?: (data: T) => void;
  debounceMs?: number;
  immediate?: boolean;
}

interface UseAsyncExecutionReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: () => Promise<void>;
  reset: () => void;
}

/**
 * 通用的异步执行Hook，统一处理加载状态、错误处理和防重复执行
 */
export const useAsyncExecution = <T>(
  asyncFn: () => Promise<T>,
  deps: React.DependencyList,
  options: UseAsyncExecutionOptions<T> = {}
): UseAsyncExecutionReturn<T> => {
  const {
    onError,
    onSuccess,
    debounceMs = 0,
    immediate = true
  } = options;

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [data, setData] = React.useState<T | null>(null);
  
  const isExecutingRef = React.useRef(false);
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const execute = React.useCallback(async () => {
    // 防止重复执行
    if (isExecutingRef.current) return;
    
    // 防抖处理
    if (debounceMs > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      return new Promise<void>((resolve) => {
        debounceTimerRef.current = setTimeout(async () => {
          await executeImmediate();
          resolve();
        }, debounceMs);
      });
    }
    
    await executeImmediate();
  }, deps);

  const executeImmediate = async () => {
    isExecutingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
      isExecutingRef.current = false;
    }
  };

  const reset = React.useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    isExecutingRef.current = false;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // 自动执行
  React.useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  // 清理定时器
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    execute,
    reset
  };
};