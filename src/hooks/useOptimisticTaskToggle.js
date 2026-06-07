import { useCallback, useRef } from 'react';
import { tasks as tasksApi } from '../api/client';

/**
 * Hook for optimistic task completion toggles.
 *
 * @param {Object} config
 * @param {Function} config.setTasks - React state setter for the task array
 * @param {Function} config.buildUpdatePayload - (task, nextCompleted) => PUT body
 * @returns {Function} Toggle handler: (task) => void
 */
export function useOptimisticTaskToggle({ setTasks, buildUpdatePayload }) {
  const versionsRef = useRef({});
  const inFlightRef = useRef(new Set());

  const toggleTask = useCallback(
    async (task) => {
      if (inFlightRef.current.has(task._id)) return;

      const previousCompleted = task.completed;
      const nextCompleted = !previousCompleted;
      const taskId = task._id;

      const version = (versionsRef.current[taskId] || 0) + 1;
      versionsRef.current[taskId] = version;
      inFlightRef.current.add(taskId);

      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, completed: nextCompleted } : t))
      );

      try {
        const payload = buildUpdatePayload(task, nextCompleted);
        const { data } = await tasksApi.update(taskId, payload);
        if (versionsRef.current[taskId] === version) {
          setTasks((prev) =>
            prev.map((t) => (t._id === taskId ? { ...t, ...data } : t))
          );
        }
      } catch (err) {
        if (versionsRef.current[taskId] === version) {
          setTasks((prev) =>
            prev.map((t) =>
              t._id === taskId ? { ...t, completed: previousCompleted } : t
            )
          );
        }
        console.error(err);
      } finally {
        inFlightRef.current.delete(taskId);
      }
    },
    [setTasks, buildUpdatePayload]
  );

  return toggleTask;
}
