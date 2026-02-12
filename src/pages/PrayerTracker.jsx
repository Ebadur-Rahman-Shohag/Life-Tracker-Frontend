import { useState, useEffect, useCallback, useMemo } from 'react';
import { prayers as prayersApi } from '../api/client';
import PrayerChecklist from '../components/PrayerChecklist';
import { PRAYER_CATEGORIES } from '../lib/categories';
import {
  formatDate,
  getWeekDates,
  getMonthDates,
  toISODateString,
  getTodayDate,
  MONTH_NAMES,
  STREAK_THRESHOLD_PERCENTAGE,
} from '../lib/dateUtils';
import {
  PRAYER_MILESTONES,
  TOTAL_DAILY_PRAYERS,
  PRAYER_PROGRESS_THRESHOLD_AMBER,
  PRAYER_PROGRESS_THRESHOLD_EMERALD,
  PRAYER_SUCCESS_THRESHOLD,
} from '../lib/trackerConstants';
import { useTrackerData } from '../hooks/useTrackerData';
import { useOptimisticToggle } from '../hooks/useOptimisticToggle';
import TrackerTable from '../components/TrackerTable';

// ============ MAIN PRAYER TRACKER COMPONENT ============

/**
 * PrayerTracker - Main component for tracking daily prayers
 * Features:
 * - Today's prayer checklist (always shows today's prayers)
 * - Weekly/Monthly calendar view with direct checkbox toggles
 * - Year overview with monthly statistics
 * - Streak tracking and milestones
 * - Optimistic UI updates with debounced refresh
 */
export default function PrayerTracker() {
  // ============ STATE MANAGEMENT ============
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // ============ COMPUTED VALUES ============
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Memoize date arrays to prevent unnecessary re-renders
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const monthDates = useMemo(() => getMonthDates(currentYear, currentMonth), [currentYear, currentMonth]);

  // Memoize today to avoid re-creating on every render
  const today = useMemo(() => getTodayDate(), []);
  const todayStr = useMemo(() => toISODateString(today), [today]);

  // ============ MEMOIZED FUNCTIONS FOR useTrackerData ============
  // Memoize date calculation functions to prevent infinite loops
  const getStartDate = useCallback(() => {
    if (view === 'week') return toISODateString(weekDates[0]);
    if (view === 'month') return toISODateString(monthDates[0]);
    return '';
  }, [view, weekDates, monthDates]);

  const getEndDate = useCallback(() => {
    if (view === 'week') return toISODateString(weekDates[6]);
    if (view === 'month') return toISODateString(monthDates[monthDates.length - 1]);
    return '';
  }, [view, weekDates, monthDates]);

  const shouldLoadDailyStats = useCallback(() => true, []);

  const onError = useCallback((err, defaultMessage) => {
    console.error(defaultMessage, err);
    return defaultMessage;
  }, []);

  // ============ SHARED DATA HOOK ============
  const {
    dailyStats,
    monthlyStats,
    streakStats,
    loading: dataLoading,
    error,
    setDailyStats,
    setLoading: setDataLoading,
    setError,
    loadDailyStats,
    loadMonthlyStats,
    loadStreakStats,
    debouncedRefresh,
    markTogglePending,
    removeTogglePending,
  } = useTrackerData({
    apiClient: prayersApi,
    getStartDate,
    getEndDate,
    view,
    currentYear,
    shouldLoadDailyStats,
    onError,
  });

  // ============ OPTIMISTIC TOGGLE HOOK ============
  const handleToggle = useOptimisticToggle({
    dailyStats,
    setDailyStats,
    apiToggle: (prayerType, dateStr, prayed) => prayersApi.toggle(prayerType, dateStr),
    updateStats: (dayStat, prayerType, prayed) => {
      const newPrayerStatuses = { ...dayStat.prayerStatuses };
      newPrayerStatuses[prayerType] = prayed;

      // Recalculate percentage
      const completedCount = Object.values(newPrayerStatuses).filter(Boolean).length;
      const newPercentage = Math.round((completedCount / TOTAL_DAILY_PRAYERS) * 100);

      return {
        ...dayStat,
        prayerStatuses: newPrayerStatuses,
        completedCount,
        percentage: newPercentage,
        isSuccessDay: completedCount === TOTAL_DAILY_PRAYERS,
        date: dayStat.date,
      };
    },
    createNewDayStat: (prayerType, prayed, dateStr) => {
      const newPrayerStatuses = { [prayerType]: prayed };
      const completedCount = prayed ? 1 : 0;
      const newPercentage = Math.round((completedCount / TOTAL_DAILY_PRAYERS) * 100);

      return {
        date: dateStr,
        prayerStatuses: newPrayerStatuses,
        completedCount,
        totalPrayers: TOTAL_DAILY_PRAYERS,
        percentage: newPercentage,
        isSuccessDay: completedCount === TOTAL_DAILY_PRAYERS,
      };
    },
    markTogglePending,
    removeTogglePending,
    debouncedRefresh,
    onError: (err) => {
      console.error('Failed to toggle prayer:', err);
      return 'Failed to update prayer. Please try again.';
    },
  });

  // ============ EFFECTS ============

  // Initial load - load all stats
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setDataLoading(true);
      setError(null);
      try {
        await Promise.all([
          loadDailyStats(false), // Complete replacement on initial load
          loadMonthlyStats(),
          loadStreakStats(),
        ]);
      } catch (err) {
        setError('Failed to load data. Please refresh the page.');
      } finally {
        setLoading(false);
        setDataLoading(false);
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load stats when view or date changes
  useEffect(() => {
    if (!loading) {
      loadDailyStats(false); // Complete replacement on view change
      loadMonthlyStats();
      loadStreakStats();
    }
  }, [view, currentDate, loading, loadDailyStats, loadMonthlyStats, loadStreakStats]);

  // ============ COMPUTED VALUES FOR UI ============

  const todayDayStats = dailyStats.find((d) => toISODateString(d.date) === todayStr);
  const prayerStatuses = todayDayStats?.prayerStatuses || {};
  const prayersForChecklist = useMemo(() => {
    return PRAYER_CATEGORIES.reduce((acc, { id }) => {
      acc[id] = prayerStatuses[id] || false;
      return acc;
    }, {});
  }, [prayerStatuses]);

  const completedToday = dailyStats.find((d) => toISODateString(d.date) === todayStr);
  const todayPercent = completedToday?.percentage || 0;

  // ============ TOGGLE HANDLERS ============

  /**
   * Handle prayer toggle from checklist (always uses today's date)
   */
  const handlePrayerToggle = useCallback(
    (category, prayed) => {
      handleToggle(category, todayStr, prayed);
    },
    [handleToggle, todayStr]
  );

  /**
   * Mark all prayers as prayed for today
   * Uses current state to determine which prayers need to be toggled
   */
  const handleMarkAllPrayed = async () => {
    const dateStr = todayStr; // Always use today's date
    try {
      setError(null);
      // Mark all as pending
      markTogglePending(dateStr);

      // Get current state to determine which prayers need to be toggled
      const currentDayStats = dailyStats.find((d) => toISODateString(d.date) === dateStr);
      const currentPrayerStatuses = currentDayStats?.prayerStatuses || {};
      const prayersToToggle = PRAYER_CATEGORIES.filter(({ id }) => !currentPrayerStatuses[id]).map(
        ({ id }) => id
      );

      // Optimistically update UI
      const allPrayedStatuses = {};
      PRAYER_CATEGORIES.forEach(({ id }) => {
        allPrayedStatuses[id] = true;
      });

      setDailyStats((prev) => {
        const existingIndex = prev.findIndex((d) => toISODateString(d.date) === dateStr);

        if (existingIndex >= 0) {
          return prev.map((dayStat, index) => {
            if (index === existingIndex) {
              return {
                ...dayStat,
                prayerStatuses: allPrayedStatuses,
                completedCount: TOTAL_DAILY_PRAYERS,
                percentage: PRAYER_SUCCESS_THRESHOLD,
                isSuccessDay: true,
                date: dateStr,
              };
            }
            return dayStat;
          });
        } else {
          return [
            ...prev,
            {
              date: dateStr,
              prayerStatuses: allPrayedStatuses,
              completedCount: TOTAL_DAILY_PRAYERS,
              totalPrayers: TOTAL_DAILY_PRAYERS,
              percentage: PRAYER_SUCCESS_THRESHOLD,
              isSuccessDay: true,
            },
          ].sort((a, b) => a.date.localeCompare(b.date));
        }
      });

      // Make API calls for prayers that aren't already marked
      for (const id of prayersToToggle) {
        await prayersApi.toggle(id, dateStr);
      }

      // Remove from pending toggles
      removeTogglePending(dateStr);

      // Debounced refresh
      debouncedRefresh();
    } catch (err) {
      console.error('Failed to mark all prayed:', err);
      setError('Failed to mark all prayers. Please try again.');
      // On error, refresh to get correct state
      await loadDailyStats(false);
      await loadStreakStats();
    }
  };

  // ============ NAVIGATION HANDLERS ============

  const navigateWeek = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const navigateYear = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(newDate.getFullYear() + direction);
    setCurrentDate(newDate);
  };

  const handleMonthClick = (monthIndex) => {
    const newDate = new Date(currentYear, monthIndex, 1);
    setCurrentDate(newDate);
    setView('month');
  };

  // ============ RENDER ============

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] text-slate-500">Loading…</div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 font-medium"
          >
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Prayer Tracker</h1>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`px-3 py-1 rounded-full font-medium ${
              (streakStats?.currentStreak || 0) > 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            Streak: {streakStats?.currentStreak || 0} days
          </span>
          <span
            className={`px-3 py-1 rounded-full font-medium ${
              todayPercent === PRAYER_SUCCESS_THRESHOLD
                ? 'bg-emerald-100 text-emerald-800'
                : todayPercent > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            Today: {todayPercent}%
          </span>
        </div>
      </div>

      {/* Today's Prayer Checklist - Main Focus */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">Today's prayers</h2>
          <div className="flex items-center gap-2">
            {Object.values(prayersForChecklist).some(Boolean) &&
              Object.values(prayersForChecklist).some((v) => !v) && (
                <button
                  onClick={handleMarkAllPrayed}
                  className="px-3 py-1 text-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg transition-colors font-medium"
                >
                  Mark all prayed
                </button>
              )}
          </div>
        </div>
        <PrayerChecklist
          prayers={prayersForChecklist}
          onToggle={handlePrayerToggle}
          disabled={false}
          embedded
        />
      </div>

      {/* View Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('week')}
          className={`px-4 py-2 rounded-lg font-medium ${
            view === 'week'
              ? 'bg-emerald-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => setView('month')}
          className={`px-4 py-2 rounded-lg font-medium ${
            view === 'month'
              ? 'bg-emerald-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          This Month
        </button>
        <button
          onClick={() => setView('year')}
          className={`px-4 py-2 rounded-lg font-medium ${
            view === 'year'
              ? 'bg-emerald-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Year Overview
        </button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            view === 'week'
              ? navigateWeek(-1)
              : view === 'month'
              ? navigateMonth(-1)
              : navigateYear(-1)
          }
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
        >
          ←
        </button>
        <span className="text-lg font-semibold text-slate-800 min-w-[200px] text-center">
          {view === 'week' && `${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}`}
          {view === 'month' && `${MONTH_NAMES[currentMonth]} ${currentYear}`}
          {view === 'year' && `${currentYear}`}
        </span>
        <button
          onClick={() =>
            view === 'week'
              ? navigateWeek(1)
              : view === 'month'
              ? navigateMonth(1)
              : navigateYear(1)
          }
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
        >
          →
        </button>
      </div>

      {/* Week / Month View - Using Shared TrackerTable Component */}
      {(view === 'week' || view === 'month') && (
        <TrackerTable
          dates={view === 'week' ? weekDates : monthDates}
          dailyStats={dailyStats}
          today={today}
          columns={PRAYER_CATEGORIES}
          getStatus={(dayStats, prayerId) => dayStats?.prayerStatuses?.[prayerId] || false}
          onToggle={(prayerId, dateStr, isCompleted) => handleToggle(prayerId, dateStr, !isCompleted)}
          progressThresholds={{
            emerald: PRAYER_PROGRESS_THRESHOLD_EMERALD,
            amber: PRAYER_PROGRESS_THRESHOLD_AMBER,
          }}
          renderColumnHeader={(category) => (
            <span className="text-slate-600 font-medium">{category.label.split(' ')[0]}</span>
          )}
          view={view}
          title={view === 'week' ? 'Weekly Progress' : 'Monthly Progress'}
        />
      )}

      {/* Year Overview */}
      {view === 'year' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Year Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MONTH_NAMES.map((monthName, index) => {
              const stats = monthlyStats?.months?.[index] || { percentage: 0 };
              const percent = stats.percentage;
              return (
                <button
                  key={monthName}
                  onClick={() => handleMonthClick(index)}
                  className="bg-slate-50 hover:bg-slate-100 rounded-xl p-4 text-left transition-colors border border-slate-200 hover:border-emerald-300"
                >
                  <h3 className="font-semibold text-slate-800 mb-2">{monthName}</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          percent >= STREAK_THRESHOLD_PERCENTAGE
                            ? 'bg-emerald-500'
                            : percent >= 50
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-600 w-10 text-right">{percent}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Streaks & Milestones */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Streaks & Milestones</h2>
        <p className="text-sm text-slate-500 mb-4">
          Complete all {TOTAL_DAILY_PRAYERS} daily prayers to maintain your streak.
        </p>

        <div className="flex flex-wrap gap-4 mb-4">
          <div className="bg-emerald-50 rounded-lg px-4 py-3">
            <p className="text-sm text-emerald-600">Current Streak</p>
            <p className="text-2xl font-bold text-emerald-700">
              {streakStats?.currentStreak || 0} days
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-600">Longest Streak</p>
            <p className="text-2xl font-bold text-amber-700">
              {streakStats?.longestStreak || 0} days
            </p>
          </div>
        </div>

        <h3 className="font-medium text-slate-700 mb-2">Milestones</h3>
        <div className="flex flex-wrap gap-2">
          {PRAYER_MILESTONES.map((days) => {
            const achieved = (streakStats?.longestStreak || 0) >= days;
            return (
              <div
                key={days}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  achieved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {achieved && '🏆 '}
                {days} days
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
