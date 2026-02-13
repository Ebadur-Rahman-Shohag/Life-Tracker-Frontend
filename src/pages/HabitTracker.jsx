import { useState, useEffect, useCallback, useMemo } from 'react';
import { habits as habitsApi } from '../api/client';
import {
  formatDate,
  getWeekDates,
  getMonthDates,
  toISODateString,
  getTodayDate,
  MONTH_NAMES,
  STREAK_THRESHOLD_PERCENTAGE,
} from '../lib/dateUtils';
import { HABIT_MILESTONES, HABIT_COLORS } from '../lib/trackerConstants';
import { useTrackerData } from '../hooks/useTrackerData';
import { useOptimisticToggle } from '../hooks/useOptimisticToggle';
import TrackerTable from '../components/TrackerTable';
import Loader from '../components/Loader';

// ============ MAIN HABIT TRACKER COMPONENT ============

/**
 * HabitTracker - Main component for tracking daily habits
 * Features:
 * - Habit CRUD operations (create, read, update, delete, reorder)
 * - Weekly/Monthly calendar view with direct checkbox toggles
 * - Year overview with monthly statistics
 * - Streak tracking and milestones (per-habit and overall)
 * - Optimistic UI updates with debounced refresh
 */
export default function HabitTracker() {
  // ============ STATE MANAGEMENT ============
  const [habits, setHabits] = useState([]);
  const [habitStreaks, setHabitStreaks] = useState({});
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Form states
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState('');
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [editHabitName, setEditHabitName] = useState('');
  const [editHabitIcon, setEditHabitIcon] = useState('');

  // ============ COMPUTED VALUES ============
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Memoize date arrays to prevent unnecessary re-renders
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const monthDates = useMemo(() => getMonthDates(currentYear, currentMonth), [currentYear, currentMonth]);

  // Memoize today to avoid re-creating on every render
  const today = useMemo(() => getTodayDate(), []);

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

  const shouldLoadDailyStats = useCallback(() => habits.length > 0, [habits.length]);

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
    apiClient: habitsApi,
    getStartDate,
    getEndDate,
    view,
    currentYear,
    shouldLoadDailyStats,
    onError,
  });

  // ============ HABIT-SPECIFIC LOADING ============

  /**
   * Load habits list
   */
  const loadHabits = useCallback(async () => {
    try {
      const res = await habitsApi.list({ activeOnly: 'true' });
      setHabits(res.data);
    } catch (err) {
      console.error('Failed to load habits:', err);
      setError('Failed to load habits.');
    }
  }, [setError]);

  /**
   * Load per-habit streaks
   */
  const loadHabitStreaks = useCallback(async () => {
    try {
      const res = await habitsApi.getHabitStreaks();
      setHabitStreaks(res.data || {});
    } catch (err) {
      console.error('Failed to load habit streaks:', err);
    }
  }, []);

  // ============ CUSTOM DEBOUNCED REFRESH WITH HABIT STREAKS ============
  const debouncedRefreshWithHabitStreaks = useCallback(() => {
    debouncedRefresh();
    // Also refresh habit streaks (this will be called immediately, which is fine)
    loadHabitStreaks();
  }, [debouncedRefresh, loadHabitStreaks]);

  // ============ OPTIMISTIC TOGGLE HOOK ============
  const handleToggle = useOptimisticToggle({
    dailyStats,
    setDailyStats,
    apiToggle: (habitId, dateStr) => habitsApi.toggleEntry(habitId, dateStr),
    updateStats: (dayStat, habitId) => {
      const newHabitStatuses = { ...dayStat.habitStatuses };
      const wasCompleted = newHabitStatuses[habitId] || false;
      newHabitStatuses[habitId] = !wasCompleted;

      // Recalculate percentage
      const completedCount = Object.values(newHabitStatuses).filter(Boolean).length;
      const totalHabits = habits.length;
      const newPercentage = totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0;

      return {
        ...dayStat,
        habitStatuses: newHabitStatuses,
        percentage: newPercentage,
        date: dayStat.date,
      };
    },
    createNewDayStat: (habitId, value, dateStr) => {
      const newHabitStatuses = { [habitId]: true };
      const newPercentage = habits.length > 0 ? Math.round((1 / habits.length) * 100) : 0;

      return {
        date: dateStr,
        habitStatuses: newHabitStatuses,
        percentage: newPercentage,
      };
    },
    markTogglePending,
    removeTogglePending,
    debouncedRefresh: debouncedRefreshWithHabitStreaks,
    onError: (err) => {
      console.error('Failed to toggle habit:', err);
      return 'Failed to toggle habit. Please try again.';
    },
  });

  // ============ EFFECTS ============

  // Initial load - load habits first, then stats
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadHabits();
      setLoading(false);
    };
    load();
  }, [loadHabits]);

  // Load stats when habits or view changes
  useEffect(() => {
    if (!loading) {
      if (habits.length > 0) {
        const loadStats = async () => {
          setDataLoading(true);
          try {
            await Promise.all([
              loadDailyStats(false), // Complete replacement on view change
              loadMonthlyStats(),
              loadStreakStats(),
              loadHabitStreaks(),
            ]);
          } finally {
            setDataLoading(false);
          }
        };
        loadStats();
      } else {
        // No habits, so no stats to load - set loading to false immediately
        setDataLoading(false);
      }
    }
  }, [
    habits.length,
    view,
    currentDate,
    loading,
    loadDailyStats,
    loadMonthlyStats,
    loadStreakStats,
    loadHabitStreaks,
    setDataLoading,
  ]);

  // ============ HABIT CRUD OPERATIONS ============

  /**
   * Handle add habit
   */
  const handleAddHabit = async (e) => {
    e.preventDefault();
    const name = newHabitName.trim();
    if (!name) return;

    try {
      await habitsApi.create({ name, icon: newHabitIcon || '✓' });
      setNewHabitName('');
      setNewHabitIcon('');
      await loadHabits();
    } catch (err) {
      console.error('Failed to add habit:', err);
      setError('Failed to add habit. Please try again.');
    }
  };

  /**
   * Handle edit habit
   */
  const startEditHabit = (habit) => {
    setEditingHabitId(habit._id);
    setEditHabitName(habit.name);
    setEditHabitIcon(habit.icon);
  };

  const cancelEditHabit = () => {
    setEditingHabitId(null);
    setEditHabitName('');
    setEditHabitIcon('');
  };

  const saveEditHabit = async () => {
    const name = editHabitName.trim();
    if (!name) return;

    try {
      await habitsApi.update(editingHabitId, { name, icon: editHabitIcon || '✓' });
      cancelEditHabit();
      await loadHabits();
    } catch (err) {
      console.error('Failed to edit habit:', err);
      setError('Failed to edit habit. Please try again.');
    }
  };

  /**
   * Handle delete habit
   */
  const handleDeleteHabit = async (id) => {
    if (!confirm('Delete this habit and all its entries?')) return;
    try {
      await habitsApi.delete(id);
      await loadHabits();
    } catch (err) {
      console.error('Failed to delete habit:', err);
      setError('Failed to delete habit. Please try again.');
    }
  };

  /**
   * Handle move habit (reorder)
   */
  const moveHabit = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= habits.length) return;

    const newHabits = [...habits];
    [newHabits[index], newHabits[targetIndex]] = [newHabits[targetIndex], newHabits[index]];

    try {
      await habitsApi.reorder(newHabits.map((h) => h._id));
      await loadHabits();
    } catch (err) {
      console.error('Failed to reorder habits:', err);
      setError('Failed to reorder habits. Please try again.');
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

  // ============ COMPUTED VALUES FOR UI ============

  const completedToday = dailyStats.find((d) => toISODateString(d.date) === toISODateString(today));
  const todayPercent = completedToday?.percentage || 0;

  // ============ RENDER ============

  if (loading || dataLoading) {
    return <Loader message="Loading habits..." />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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
        <h1 className="text-2xl font-bold text-slate-800">Habit Tracker</h1>
        <div className="flex items-center gap-3 text-sm">
          <span
            className={`px-3 py-1 rounded-full font-medium ${(streakStats?.currentStreak || 0) > 0
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-600'
              }`}
          >
            Streak: {streakStats?.currentStreak || 0} days
          </span>
          <span
            className={`px-3 py-1 rounded-full font-medium ${todayPercent >= STREAK_THRESHOLD_PERCENTAGE
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

      {/* View Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('week')}
          className={`px-4 py-2 rounded-lg font-medium ${view === 'week'
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          This Week
        </button>
        <button
          onClick={() => setView('month')}
          className={`px-4 py-2 rounded-lg font-medium ${view === 'month'
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          This Month
        </button>
        <button
          onClick={() => setView('year')}
          className={`px-4 py-2 rounded-lg font-medium ${view === 'year'
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          Year Overview
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            view === 'week' ? navigateWeek(-1) : view === 'month' ? navigateMonth(-1) : navigateYear(-1)
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
            view === 'week' ? navigateWeek(1) : view === 'month' ? navigateMonth(1) : navigateYear(1)
          }
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
        >
          →
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-700"
        >
          Today
        </button>
      </div>

      {/* Habits Management Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">My Habits</h2>

        {/* Add Habit Form */}
        <form onSubmit={handleAddHabit} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newHabitIcon}
            onChange={(e) => setNewHabitIcon(e.target.value)}
            placeholder="✓"
            className="w-12 rounded-lg border border-slate-300 px-2 py-2 text-center text-slate-800 placeholder-slate-400"
            maxLength={2}
          />
          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder="Add a new habit..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder-slate-400"
          />
          <button
            type="submit"
            disabled={!newHabitName.trim()}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            Add
          </button>
        </form>

        {/* Habits List */}
        {habits.length === 0 ? (
          <p className="text-slate-500 text-sm">No habits yet. Add your first habit above.</p>
        ) : (
          <ul className="space-y-2">
            {habits.map((habit, index) => (
              <li key={habit._id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2">
                {editingHabitId === habit._id ? (
                  <>
                    <input
                      type="text"
                      value={editHabitIcon}
                      onChange={(e) => setEditHabitIcon(e.target.value)}
                      className="w-10 rounded border border-slate-300 px-2 py-1 text-center text-slate-800"
                      maxLength={2}
                    />
                    <input
                      type="text"
                      value={editHabitName}
                      onChange={(e) => setEditHabitName(e.target.value)}
                      className="flex-1 rounded border border-slate-300 px-2 py-1 text-slate-800"
                      autoFocus
                    />
                    <button
                      onClick={saveEditHabit}
                      className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                    >
                      Save
                    </button>
                    <button onClick={cancelEditHabit} className="text-slate-500 hover:text-slate-700 text-sm">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className={`w-3 h-3 rounded-full ${HABIT_COLORS[index % HABIT_COLORS.length].dot
                        }`}
                    ></span>
                    <span className="text-lg w-8 text-center">{habit.icon}</span>
                    <span className="flex-1 text-slate-800">{habit.name}</span>
                    {habitStreaks[habit._id] && (
                      <div className="flex items-center gap-2 mr-2">
                        {habitStreaks[habit._id].currentStreak > 0 && (
                          <span
                            className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium"
                            title={`Current streak: ${habitStreaks[habit._id].currentStreak} days`}
                          >
                            🔥 {habitStreaks[habit._id].currentStreak}
                          </span>
                        )}
                        {habitStreaks[habit._id].longestStreak > 0 && (
                          <span
                            className="text-xs text-slate-500"
                            title={`Longest streak: ${habitStreaks[habit._id].longestStreak} days`}
                          >
                            Best: {habitStreaks[habit._id].longestStreak}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveHabit(index, -1)}
                        disabled={index === 0}
                        className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveHabit(index, 1)}
                        disabled={index === habits.length - 1}
                        className="text-slate-400 hover:text-slate-600 text-sm px-1 disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => startEditHabit(habit)}
                      className="text-slate-400 hover:text-emerald-600 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteHabit(habit._id)}
                      className="text-slate-400 hover:text-red-600 text-sm"
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Weekly/Monthly View - Using Shared TrackerTable Component */}
      {(view === 'week' || view === 'month') && habits.length > 0 && (
        <TrackerTable
          dates={view === 'week' ? weekDates : monthDates}
          dailyStats={dailyStats}
          today={today}
          columns={habits}
          getStatus={(dayStats, habitId) => dayStats?.habitStatuses?.[habitId] || false}
          onToggle={(habitId, dateStr) => handleToggle(habitId, dateStr)}
          progressThresholds={{ emerald: STREAK_THRESHOLD_PERCENTAGE, amber: 50 }}
          renderColumnHeader={(habit, index) => (
            <div className="flex items-center justify-center" title={habit.name}>
              <span className={`w-4 h-4 rounded-full ${HABIT_COLORS[index % HABIT_COLORS.length].dot}`}></span>
            </div>
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
                        className={`h-full rounded-full transition-all ${percent >= STREAK_THRESHOLD_PERCENTAGE
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
          Complete {STREAK_THRESHOLD_PERCENTAGE}% or more of your habits daily to maintain your streak.
        </p>

        <div className="flex flex-wrap gap-4 mb-4">
          <div className="bg-emerald-50 rounded-lg px-4 py-3">
            <p className="text-sm text-emerald-600">Current Streak</p>
            <p className="text-2xl font-bold text-emerald-700">{streakStats?.currentStreak || 0} days</p>
          </div>
          <div className="bg-amber-50 rounded-lg px-4 py-3">
            <p className="text-sm text-amber-600">Longest Streak</p>
            <p className="text-2xl font-bold text-amber-700">{streakStats?.longestStreak || 0} days</p>
          </div>
        </div>

        <h3 className="font-medium text-slate-700 mb-2">Milestones</h3>
        <div className="flex flex-wrap gap-2">
          {HABIT_MILESTONES.map((milestone) => {
            const achieved = (streakStats?.longestStreak || 0) >= milestone;
            return (
              <div
                key={milestone}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${achieved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}
              >
                {achieved && '🏆 '}
                {milestone} days
              </div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {habits.length === 0 && (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-slate-600 mb-2">No habits yet.</p>
          <p className="text-sm text-slate-500">Add your first habit above to start tracking your progress.</p>
        </div>
      )}
    </div>
  );
}
