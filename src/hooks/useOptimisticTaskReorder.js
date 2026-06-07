import { useCallback, useRef } from 'react';
import { tasks as tasksApi } from '../api/client';

/**
 * Hook for optimistic task list reordering.
 *
 * @param {Object} config
 * @param {Function} config.setTasks - React state setter for the task array
 * @param {Function} config.sortTasks - (tasks) => sorted copy
 * @returns {{ moveTask: Function, moveTaskToPosition: Function }}
 */
export function useOptimisticTaskReorder({ setTasks, sortTasks }) {
  const versionRef = useRef(0);

  const persistReorder = useCallback(
    async (computeReordered) => {
      let snapshot = null;
      let taskIds = null;
      let moved = false;

      setTasks((prev) => {
        snapshot = prev;
        const sorted = sortTasks(prev);
        const reordered = computeReordered(sorted);
        if (!reordered) return prev;

        taskIds = reordered.map((t) => t._id);
        moved = true;
        return reordered.map((t, index) => ({ ...t, order: index }));
      });

      if (!moved || !taskIds) return;

      const version = ++versionRef.current;
      try {
        await tasksApi.reorder(taskIds);
      } catch (err) {
        if (versionRef.current === version && snapshot) {
          setTasks(snapshot);
        }
        console.error(err);
      }
    },
    [setTasks, sortTasks]
  );

  const moveTask = useCallback(
    (task, direction) => {
      persistReorder((sorted) => {
        const idx = sorted.findIndex((t) => t._id === task._id);
        if (idx < 0) return null;
        const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (otherIdx < 0 || otherIdx >= sorted.length) return null;

        const reordered = [...sorted];
        [reordered[idx], reordered[otherIdx]] = [reordered[otherIdx], reordered[idx]];
        return reordered;
      });
    },
    [persistReorder]
  );

  const moveTaskToPosition = useCallback(
    (task, position) => {
      persistReorder((sorted) => {
        const idx = sorted.findIndex((t) => t._id === task._id);
        if (idx < 0) return null;

        const targetIdx = Math.min(Math.max(Math.round(position), 1), sorted.length) - 1;
        if (targetIdx === idx) return null;

        const reordered = [...sorted];
        const [item] = reordered.splice(idx, 1);
        reordered.splice(targetIdx, 0, item);
        return reordered;
      });
    },
    [persistReorder]
  );

  return { moveTask, moveTaskToPosition };
}
