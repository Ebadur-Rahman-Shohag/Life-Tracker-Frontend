import { useState, useEffect, useCallback, useRef } from 'react';
import { toISODateString, DEBOUNCE_DELAY_MS } from '../lib/dateUtils';

/**
 * Custom hook for tracker data management
 * Handles data loading, optimistic updates, debounced refresh, and race condition prevention
 * 
 * @param {Object} config - Configuration object
 * @param {Object} config.apiClient - API client with methods: getDailyStats, getMonthlyStats, getStreakStats
 * @param {Function} config.getStartDate - Function to get start date for current view
 * @param {Function} config.getEndDate - Function to get end date for current view
 * @param {string} config.view - Current view ('week' | 'month' | 'year')
 * @param {number} config.currentYear - Current year for monthly stats
 * @param {Function} config.shouldLoadDailyStats - Optional function to determine if daily stats should load
 * @param {Function} config.onError - Optional error handler
 * @returns {Object} Tracker data and handlers
 */
export function useTrackerData({
  apiClient,
  getStartDate,
  getEndDate,
  view,
  currentYear,
  shouldLoadDailyStats = () => true,
  onError = null,
}) {
  // ============ STATE ============
  const [dailyStats, setDailyStats] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [streakStats, setStreakStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track pending toggles to prevent race conditions
  const pendingTogglesRef = useRef(new Set());
  const refreshTimeoutRef = useRef(null);
  const latestRefreshRequestRef = useRef(0);

  // ============ ERROR HANDLING ============
  const handleError = useCallback(
    (err, defaultMessage) => {
      console.error(defaultMessage, err);
      const errorMessage = onError ? onError(err, defaultMessage) : defaultMessage;
      setError(errorMessage);
    },
    [onError]
  );

  // ============ DATA LOADING FUNCTIONS ============

  /**
   * Load daily stats based on view with intelligent merging
   * @param {boolean} mergeWithOptimistic - Whether to merge with optimistic updates
   */
  const loadDailyStats = useCallback(
    async (mergeWithOptimistic = true) => {
      if (!shouldLoadDailyStats()) {
        setDailyStats([]);
        return;
      }

      try {
        setError(null);
        let startDate, endDate;

        if (view === 'week' || view === 'month') {
          startDate = getStartDate();
          endDate = getEndDate();
        } else {
          return;
        }

        const requestId = ++latestRefreshRequestRef.current;
        const res = await apiClient.getDailyStats(startDate, endDate);

        // Only update if this is still the latest request (prevents race conditions)
        if (requestId !== latestRefreshRequestRef.current) {
          return;
        }

        const serverData = res.data.days || [];

        if (mergeWithOptimistic) {
          // Merge server data with current optimistic state
          setDailyStats((prevStats) => {
            const merged = new Map();

            // First, add all server data (normalized dates)
            serverData.forEach((day) => {
              const dateKey = toISODateString(day.date);
              merged.set(dateKey, {
                ...day,
                date: dateKey, // Normalize date format
              });
            });

            // Then, preserve optimistic updates for pending toggles
            prevStats.forEach((day) => {
              const dateKey = toISODateString(day.date);

              // If there's ANY pending toggle for this date, preserve the optimistic state
              if (hasAnyPendingForDate(dateKey)) {
                console.log(`[Merge] Preserving optimistic state for ${dateKey}`);
                merged.set(dateKey, {
                  ...day,
                  date: dateKey,
                });
              } else if (!merged.has(dateKey)) {
                // Keep optimistic entries that aren't in server data yet
                merged.set(dateKey, {
                  ...day,
                  date: dateKey,
                });
              }
            });

            return Array.from(merged.values());
          });
        } else {
          // Complete replacement (for initial load)
          setDailyStats(
            serverData.map((day) => ({
              ...day,
              date: toISODateString(day.date), // Normalize date format
            }))
          );
        }
      } catch (err) {
        handleError(err, 'Failed to load daily stats');
      }
    },
    [view, getStartDate, getEndDate, apiClient, shouldLoadDailyStats, handleError]
  );

  /**
   * Load monthly stats for year view
   */
  const loadMonthlyStats = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.getMonthlyStats(currentYear);
      setMonthlyStats(res.data);
    } catch (err) {
      handleError(err, 'Failed to load monthly stats');
    }
  }, [currentYear, apiClient, handleError]);

  /**
   * Load streak stats
   */
  const loadStreakStats = useCallback(async () => {
    try {
      setError(null);
      const res = await apiClient.getStreakStats();
      setStreakStats(res.data);
    } catch (err) {
      handleError(err, 'Failed to load streak stats');
    }
  }, [apiClient, handleError]);

  // ============ DEBOUNCED REFRESH ============

  /**
   * Debounced refresh function to prevent rapid overwrites
   * Only refreshes if there are no pending toggles
   */
  const debouncedRefresh = useCallback(() => {
    // Clear existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // Set new timeout
    refreshTimeoutRef.current = setTimeout(async () => {
      // Only refresh if there are no pending toggles
      if (pendingTogglesRef.current.size === 0) {
        try {
          await Promise.all([
            loadDailyStats(true), // Merge with optimistic updates
            loadStreakStats(),
            view === 'year' ? loadMonthlyStats() : Promise.resolve(),
          ]);
        } catch (err) {
          handleError(err, 'Failed to refresh stats');
        }
      }
    }, DEBOUNCE_DELAY_MS);
  }, [loadDailyStats, loadStreakStats, loadMonthlyStats, view, handleError]);

  // ============ TOGGLE HELPERS ============

  /**
   * Mark a toggle as pending
   */
  const markTogglePending = useCallback((dateStr, id = null) => {
    // Use date + id for unique key per toggle, or just date if no id provided
    const toggleKey = id ? `${dateStr}-${id}` : `${dateStr}`;
    pendingTogglesRef.current.add(toggleKey);
  }, []);

  /**
   * Remove a toggle from pending
   */
  const removeTogglePending = useCallback((dateStr, id = null) => {
    // Use date + id for unique key per toggle, or just date if no id provided
    const toggleKey = id ? `${dateStr}-${id}` : `${dateStr}`;
    pendingTogglesRef.current.delete(toggleKey);
  }, []);

  /**
   * Check if any toggle is pending for a date
   */
  const hasAnyPendingForDate = useCallback((dateStr) => {
    // Check if any pending toggle key starts with this date
    for (const key of pendingTogglesRef.current) {
      if (key.startsWith(dateStr)) {
        return true;
      }
    }
    return false;
  }, []);

  // ============ CLEANUP ============

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    dailyStats,
    monthlyStats,
    streakStats,
    loading,
    error,
    setDailyStats,
    setLoading,
    setError,

    // Loading functions
    loadDailyStats,
    loadMonthlyStats,
    loadStreakStats,

    // Refresh
    debouncedRefresh,

    // Toggle helpers
    markTogglePending,
    removeTogglePending,
    hasAnyPendingForDate,
  };
}
