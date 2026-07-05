import { useCallback } from 'react';

/**
 * Optimistic task toggle — mirrors useOptimisticToggle for habits/prayers.
 */
export function useOptimisticTaskToggle({
  tasks,
  setTasks,
  apiToggle,
  getToggleDate,
  markTogglePending,
  removeTogglePending,
  debouncedRefresh,
  onError = null,
}) {
  const handleToggle = useCallback(
    async (task) => {
      const previousTasks = [...tasks];
      const taskId = task._id;

      markTogglePending(taskId);

      setTasks((prev) =>
        prev.map((t) =>
          t._id === taskId ? { ...t, completed: !t.completed } : t
        )
      );

      try {
        const dateStr = getToggleDate ? getToggleDate(task) : undefined;
        await apiToggle(taskId, dateStr);

        debouncedRefresh();

        setTimeout(() => {
          removeTogglePending(taskId);
        }, 350);
      } catch (err) {
        removeTogglePending(taskId);
        setTasks(previousTasks);
        if (onError) onError(err);
      }
    },
    [
      tasks,
      setTasks,
      apiToggle,
      getToggleDate,
      markTogglePending,
      removeTogglePending,
      debouncedRefresh,
      onError,
    ]
  );

  return handleToggle;
}
