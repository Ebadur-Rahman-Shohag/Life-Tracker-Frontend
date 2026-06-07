import { useCallback, useRef } from 'react';
import { habits as habitsApi } from '../api/client';

/**
 * Hook for optimistic habit list reordering.
 *
 * @param {Object} config
 * @param {Function} config.setHabits - React state setter for the habit array
 * @returns {{ moveHabit: Function, moveHabitToPosition: Function }}
 */
export function useOptimisticHabitReorder({ setHabits }) {
  const versionRef = useRef(0);

  const persistReorder = useCallback(
    async (computeReordered) => {
      let snapshot = null;
      let habitIds = null;
      let moved = false;

      setHabits((prev) => {
        snapshot = prev;
        const reordered = computeReordered(prev);
        if (!reordered) return prev;

        habitIds = reordered.map((h) => h._id);
        moved = true;
        return reordered.map((h, index) => ({ ...h, order: index }));
      });

      if (!moved || !habitIds) return;

      const version = ++versionRef.current;
      try {
        await habitsApi.reorder(habitIds);
      } catch (err) {
        if (versionRef.current === version && snapshot) {
          setHabits(snapshot);
        }
        console.error(err);
      }
    },
    [setHabits]
  );

  const moveHabit = useCallback(
    (habit, direction) => {
      persistReorder((habits) => {
        const idx = habits.findIndex((h) => h._id === habit._id);
        if (idx < 0) return null;
        const otherIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (otherIdx < 0 || otherIdx >= habits.length) return null;

        const reordered = [...habits];
        [reordered[idx], reordered[otherIdx]] = [reordered[otherIdx], reordered[idx]];
        return reordered;
      });
    },
    [persistReorder]
  );

  const moveHabitToPosition = useCallback(
    (habit, position) => {
      persistReorder((habits) => {
        const idx = habits.findIndex((h) => h._id === habit._id);
        if (idx < 0) return null;

        const targetIdx = Math.min(Math.max(Math.round(position), 1), habits.length) - 1;
        if (targetIdx === idx) return null;

        const reordered = [...habits];
        const [item] = reordered.splice(idx, 1);
        reordered.splice(targetIdx, 0, item);
        return reordered;
      });
    },
    [persistReorder]
  );

  return { moveHabit, moveHabitToPosition };
}
