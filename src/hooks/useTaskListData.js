import { useCallback, useEffect, useRef } from 'react';
import { DEBOUNCE_DELAY_MS } from '../lib/dateUtils';

/**
 * Task list data management mirroring useTrackerData for habits/prayers.
 * Handles pending toggles, optimistic merge on load, and debounced refresh.
 */
export function useTaskListData({ fetchTasks, setTasks, onError = null }) {
  const pendingTogglesRef = useRef(new Set());
  const refreshTimeoutRef = useRef(null);
  const latestLoadRequestRef = useRef(0);

  const isTaskPending = useCallback((taskId) => {
    return pendingTogglesRef.current.has(taskId);
  }, []);

  const loadTasks = useCallback(
    async (mergeWithOptimistic = true) => {
      const requestId = ++latestLoadRequestRef.current;
      const serverTasks = await fetchTasks();
      if (requestId !== latestLoadRequestRef.current) return serverTasks;

      if (mergeWithOptimistic) {
        setTasks((prevTasks) => {
          const prevById = new Map(prevTasks.map((t) => [t._id, t]));
          return serverTasks.map((serverTask) => {
            if (pendingTogglesRef.current.has(serverTask._id)) {
              const prev = prevById.get(serverTask._id);
              if (prev) return { ...serverTask, completed: prev.completed };
            }
            return serverTask;
          });
        });
      } else {
        setTasks(serverTasks);
      }
      return serverTasks;
    },
    [fetchTasks, setTasks]
  );

  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(async () => {
      if (pendingTogglesRef.current.size === 0) {
        try {
          await loadTasks(true);
        } catch (err) {
          if (onError) onError(err, 'Failed to refresh tasks');
        }
      }
    }, DEBOUNCE_DELAY_MS);
  }, [loadTasks, onError]);

  const markTogglePending = useCallback((taskId) => {
    pendingTogglesRef.current.add(taskId);
  }, []);

  const removeTogglePending = useCallback((taskId) => {
    pendingTogglesRef.current.delete(taskId);
  }, []);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadTasks,
    debouncedRefresh,
    markTogglePending,
    removeTogglePending,
    isTaskPending,
  };
}
