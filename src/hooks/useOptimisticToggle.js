import { useCallback } from 'react';
import { toISODateString } from '../lib/dateUtils';

/**
 * Hook for handling optimistic toggle updates
 * 
 * @param {Object} config
 * @param {Array} config.dailyStats - Current daily stats
 * @param {Function} config.setDailyStats - State setter for daily stats
 * @param {Function} config.apiToggle - API function to call: (id, dateStr, value) => Promise
 * @param {Function} config.updateStats - Function to update stats: (dayStat, id, value) => newDayStat
 * @param {Function} config.createNewDayStat - Function to create new day stat: (id, value, dateStr) => newDayStat
 * @param {Function} config.markTogglePending - Function to mark toggle as pending
 * @param {Function} config.removeTogglePending - Function to remove toggle from pending
 * @param {Function} config.debouncedRefresh - Function to trigger debounced refresh (returns Promise)
 * @param {Function} config.onError - Optional error handler
 * @returns {Function} Toggle handler function
 */
export function useOptimisticToggle({
  dailyStats,
  setDailyStats,
  apiToggle,
  updateStats,
  createNewDayStat,
  markTogglePending,
  removeTogglePending,
  debouncedRefresh,
  onError = null,
}) {
  const handleToggle = useCallback(
    async (id, dateStr, value = undefined) => {
      // Store previous state for rollback on error
      const previousStats = [...dailyStats];

      // Mark this toggle as pending (with unique id)
      markTogglePending(dateStr, id);
      console.log(`[Toggle] Marked pending: ${dateStr}-${id}`);

      // Optimistically update the UI immediately
      setDailyStats((prev) => {
        const existingIndex = prev.findIndex((d) => toISODateString(d.date) === dateStr);

        if (existingIndex >= 0) {
          // Update existing entry
          return prev.map((dayStat, index) => {
            if (index === existingIndex) {
              return updateStats(dayStat, id, value);
            }
            return dayStat;
          });
        } else {
          // Create new entry for this date
          const newDayStat = createNewDayStat(id, value, dateStr);
          return [...prev, newDayStat].sort((a, b) => a.date.localeCompare(b.date));
        }
      });

      // Make API call in background (non-blocking)
      try {
        // If value is undefined, call apiToggle without it (for habits)
        let apiResponse;
        if (value === undefined) {
          console.log(`[Toggle] API call - habitId: ${id}, date: ${dateStr}`);
          apiResponse = await apiToggle(id, dateStr);
        } else {
          console.log(`[Toggle] API call - prayerType: ${id}, date: ${dateStr}, value: ${value}`);
          apiResponse = await apiToggle(id, dateStr, value);
        }
        console.log(`[Toggle] API response:`, apiResponse.data);

        // Trigger debounced refresh FIRST
        debouncedRefresh();
        
        // Remove from pending toggles AFTER the debounce delay completes
        // This ensures the refresh sees the pending state and preserves optimistic updates
        // Using 350ms (DEBOUNCE_DELAY_MS + 50ms buffer) to ensure refresh executes first
        setTimeout(() => {
          console.log(`[Toggle] Removing pending: ${dateStr}-${id}`);
          removeTogglePending(dateStr, id);
        }, 350);
      } catch (err) {
        const errorMessage = onError ? onError(err) : 'Failed to toggle. Please try again.';
        console.error('[Toggle] API call failed:', err);
        console.error('[Toggle] Error details:', err.response?.data);

        // Remove from pending toggles on error immediately
        removeTogglePending(dateStr, id);

        // Revert to previous state on error
        setDailyStats(previousStats);
      }
    },
    [
      dailyStats,
      setDailyStats,
      apiToggle,
      updateStats,
      createNewDayStat,
      markTogglePending,
      removeTogglePending,
      debouncedRefresh,
      onError,
    ]
  );

  return handleToggle;
}
